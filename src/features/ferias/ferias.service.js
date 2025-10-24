// src/features/ferias/ferias.service.js

const { Op, fn, col, literal } = require('sequelize');
const axios = require('axios');
const { Ferias, Funcionario, Planejamento, Afastamento, sequelize } = require('../../models');
// ==========================================================
// ALTERAÇÃO: Importando funções adicionais de date-fns para validação
// ==========================================================
const { addYears, addMonths, addDays, differenceInDays, isWithinInterval, getDay, format, getYear, parseISO, startOfDay, isValid } = require('date-fns');

/**
 * Busca os feriados nacionais de um determinado ano usando a BrasilAPI.
 */
async function getFeriadosNacionais(ano) {
    try {
        console.log(`Buscando feriados nacionais para o ano ${ano}...`);
        const response = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
        const feriados = response.data.map(feriado => feriado.date);
        console.log(`Feriados encontrados: ${feriados.length}`);
        return feriados;
    } catch (error) {
        console.error(`Falha ao buscar feriados da BrasilAPI para o ano ${ano}. Usando lista de fallback.`, error.message);
        return [`${ano}-01-01`, `${ano}-04-21`, `${ano}-05-01`, `${ano}-09-07`, `${ano}-10-12`, `${ano}-11-02`, `${ano}-11-15`, `${ano}-12-25`];
    }
}

/**
 * RECALCULA O PERÍODO AQUISITIVO E O SALDO DE FÉRIAS DE UM FUNCIONÁRIO.
 */
async function recalcularPeriodoAquisitivo(matricula) {
    const funcionario = await Funcionario.findByPk(matricula, {
        include: [{ model: Afastamento, as: 'historicoAfastamentos' }]
    });

    if (!funcionario) {
        throw new Error(`Funcionário com matrícula ${matricula} não encontrado para recálculo.`);
    }

    const hoje = new Date();
    const anosDeEmpresa = differenceInDays(hoje, funcionario.dth_admissao) / 365.25;
    const ultimoAniversarioDeEmpresa = addYears(funcionario.dth_admissao, Math.floor(anosDeEmpresa));
    
    let periodoBaseInicio = ultimoAniversarioDeEmpresa;
    if (periodoBaseInicio > hoje) {
        periodoBaseInicio = addYears(periodoBaseInicio, -1);
    }
    let periodoBaseFim = addDays(addYears(periodoBaseInicio, 1), -1);

    let diasDeAfastamentoDoencaNoPeriodo = 0;
    let diasDeLicencaNaoRemuneradaNoPeriodo = 0;

    if (funcionario.historicoAfastamentos) {
        for (const af of funcionario.historicoAfastamentos) {
            if (!af.impacta_ferias) continue;

            const inicioAfastamento = new Date(af.data_inicio);
            const fimAfastamento = new Date(af.data_fim || hoje);
            const inicioPeriodo = new Date(periodoBaseInicio);

            if (af.motivo.toLowerCase().includes('doença') || af.motivo.toLowerCase().includes('acidente')) {
                const diasNoPeriodo = differenceInDays(fimAfastamento, inicioAfastamento);
                diasDeAfastamentoDoencaNoPeriodo += diasNoPeriodo;
                
                if(diasDeAfastamentoDoencaNoPeriodo > 180) {
                    const dataRetorno = addDays(fimAfastamento, 1);
                    funcionario.periodo_aquisitivo_atual_inicio = dataRetorno;
                    funcionario.periodo_aquisitivo_atual_fim = addDays(addYears(dataRetorno, 1), -1);
                    funcionario.faltas_injustificadas_periodo = 0; 
                    break;
                }
            }
            
            if (af.motivo.toLowerCase().includes('licença não remunerada') || af.motivo.toLowerCase().includes('cárcere')) {
                 if(isWithinInterval(inicioAfastamento, { start: inicioPeriodo, end: new Date(periodoBaseFim) })) {
                    diasDeLicencaNaoRemuneradaNoPeriodo += differenceInDays(fimAfastamento, inicioAfastamento);
                 }
            }
        }
    }
    
    if(diasDeAfastamentoDoencaNoPeriodo <= 180) {
        const novoFimPeriodo = addDays(new Date(periodoBaseFim), diasDeLicencaNaoRemuneradaNoPeriodo);
        funcionario.periodo_aquisitivo_atual_inicio = periodoBaseInicio;
        funcionario.periodo_aquisitivo_atual_fim = novoFimPeriodo;
    }
  
    funcionario.dth_limite_ferias = addMonths(new Date(funcionario.periodo_aquisitivo_atual_fim), 11);
  
    const faltas = funcionario.faltas_injustificadas_periodo || 0;
    if (faltas <= 5) funcionario.saldo_dias_ferias = 30;
    else if (faltas <= 14) funcionario.saldo_dias_ferias = 24;
    else if (faltas <= 23) funcionario.saldo_dias_ferias = 18;
    else if (faltas <= 32) funcionario.saldo_dias_ferias = 12;
    else funcionario.saldo_dias_ferias = 0;

    await funcionario.save();
    return funcionario;
}

/**
 * Função auxiliar para verificar se a data de início das férias é válida.
 */
function isDataValidaInicio(data, funcionario, feriados) {
    const dataChecagem = new Date(`${data}T12:00:00Z`);
    const diaDaSemana = getDay(dataChecagem);

    const convencoesExcecao = ['SEEACEPI', 'SECAPI Interior'];
    if (funcionario.convencao && convencoesExcecao.some(c => funcionario.convencao.includes(c))) {
        return diaDaSemana !== 0; // Para estas convenções, só não pode iniciar no Domingo
    }

    // Regra geral: Não pode iniciar em Sábado, Domingo ou Sexta-feira
    if (diaDaSemana === 6 || diaDaSemana === 0 || diaDaSemana === 5) {
        return false;
    }

    const diaSeguinte = format(addDays(dataChecagem, 1), 'yyyy-MM-dd');
    const doisDiasDepois = format(addDays(dataChecagem, 2), 'yyyy-MM-dd');

    // Não pode iniciar nos 2 dias que antecedem feriados
    if (feriados.includes(diaSeguinte) || feriados.includes(doisDiasDepois)) {
        return false;
    }
    
    return true;
};

/**
 * Orquestra a criação de um novo planejamento de férias para um ano.
 */
async function distribuirFerias(ano, descricao, options = {}) {
    const { transaction, dataInicioDist, dataFimDist } = options;
    console.log(`[LOG FÉRIAS SERVICE] Iniciando distribuição. Ano: ${ano}. Período: ${dataInicioDist || 'Padrão'} a ${dataFimDist || 'Padrão'}`);
    
    const t = transaction || await sequelize.transaction();
    const transactionOptions = { transaction: t };

    try {
        await Planejamento.update({ status: 'arquivado' }, { where: { ano, status: 'ativo' }, ...transactionOptions });
        
        const novoPlanejamento = await Planejamento.create({
            ano,
            descricao: descricao || `Distribuição automática para ${ano}`,
            status: 'ativo'
        }, transactionOptions);
        console.log(`[LOG FÉRIAS SERVICE] Novo planejamento ID ${novoPlanejamento.id} criado.`);

        // ==========================================================
        // ALTERAÇÃO: PRESERVAR FÉRIAS MANUAIS
        // Buscar férias manuais ou confirmadas para excluí-las da redistribuição
        // ==========================================================
        const feriasManuais = await Ferias.findAll({
            where: {
                planejamentoId: { [Op.ne]: null }, // De planejamentos anteriores do mesmo ano
                ajuste_manual: true,
                status: { [Op.in]: ['Confirmada', 'Planejada'] }
            },
            ...transactionOptions
        });
        const matriculasManuais = new Set(feriasManuais.map(f => f.matricula_funcionario));

        const funcionariosElegiveis = await Funcionario.findAll({
            where: {
                status: 'Ativo',
                dth_limite_ferias: { [Op.not]: null },
                situacao_ferias_afastamento_hoje: { [Op.or]: [ { [Op.is]: null }, { [Op.notILike]: '%aviso prévio%' } ] },
                // Exclui funcionários que já têm férias manuais/confirmadas
                matricula: { [Op.notIn]: Array.from(matriculasManuais) }
            },
            order: [['dth_limite_ferias', 'ASC']],
            ...transactionOptions
        });

        console.log(`[LOG FÉRIAS SERVICE] ${funcionariosElegiveis.length} funcionários elegíveis encontrados para distribuição automática.`);
        
        if (funcionariosElegiveis.length === 0 && feriasManuais.length === 0) {
            if (!transaction) await t.commit();
            return { message: `Planejamento para ${ano} criado, mas nenhum funcionário era elegível.` };
        }

        const feriadosDoAno = await getFeriadosNacionais(ano);
        const feriasParaCriar = [];
        const calendarioOcupacao = {};

        for (const funcionario of funcionariosElegiveis) {
            const diasDeFerias = funcionario.saldo_dias_ferias;
            if (diasDeFerias <= 0) continue;

            let dataInicioEncontrada = false;
            
            // ==========================================================
            // CORREÇÃO: Lógica de datas para respeitar o período selecionado
            // ==========================================================
            let dataAtual;
            // 1. Usa a data de início fornecida se for válida
            if (dataInicioDist && isValid(parseISO(dataInicioDist))) {
                dataAtual = startOfDay(parseISO(dataInicioDist));
            } else {
                // 2. Se não, usa a maior data entre hoje e o início do período aquisitivo
                const hoje = startOfDay(new Date());
                const inicioPeriodoAquisitivo = startOfDay(new Date(funcionario.periodo_aquisitivo_atual_inicio));
                dataAtual = hoje > inicioPeriodoAquisitivo ? hoje : inicioPeriodoAquisitivo;
            }

            // 3. Define a data limite da busca
            const dataLimiteBusca = dataFimDist && isValid(parseISO(dataFimDist))
                ? startOfDay(parseISO(dataFimDist)) 
                : startOfDay(new Date(funcionario.dth_limite_ferias));
            // ==========================================================

            while (!dataInicioEncontrada && dataAtual < dataLimiteBusca) {
                if (isDataValidaInicio(format(dataAtual, 'yyyy-MM-dd'), funcionario, feriadosDoAno)) {
                    const mes = dataAtual.toLocaleString('pt-BR', { month: 'long' });
                    const municipio = funcionario.municipio_local_trabalho || 'N/A';
                    const chaveOcupacao = `${municipio}-${mes}`;
                    
                    if (!calendarioOcupacao[chaveOcupacao]) calendarioOcupacao[chaveOcupacao] = 0;

                    if (calendarioOcupacao[chaveOcupacao] < 5) {
                        const dataFim = addDays(dataAtual, diasDeFerias - 1);
                        feriasParaCriar.push({
                            matricula_funcionario: funcionario.matricula,
                            planejamentoId: novoPlanejamento.id,
                            data_inicio: format(dataAtual, 'yyyy-MM-dd'),
                            data_fim: format(dataFim, 'yyyy-MM-dd'),
                            qtd_dias: diasDeFerias,
                            periodo_aquisitivo_inicio: funcionario.periodo_aquisitivo_atual_inicio,
                            periodo_aquisitivo_fim: funcionario.periodo_aquisitivo_atual_fim,
                            status: 'Planejada',
                            ajuste_manual: false // Gerado automaticamente
                        });
                        calendarioOcupacao[chaveOcupacao]++;
                        dataInicioEncontrada = true;
                    }
                }
                dataAtual = addDays(dataAtual, 1);
            }
        }

        console.log(`[LOG FÉRIAS SERVICE] ${feriasParaCriar.length} registros de férias automáticas serão criados.`);

        if (feriasParaCriar.length > 0) {
            await Ferias.bulkCreate(feriasParaCriar, transactionOptions);
        }
        
        // ==========================================================
        // ALTERAÇÃO: Reassociar as férias manuais ao novo planejamento
        // ==========================================================
        if (feriasManuais.length > 0) {
            const idsFeriasManuais = feriasManuais.map(f => f.id);
            await Ferias.update(
                { planejamentoId: novoPlanejamento.id },
                { where: { id: { [Op.in]: idsFeriasManuais } }, ...transactionOptions }
            );
            console.log(`[LOG FÉRIAS SERVICE] ${feriasManuais.length} registros manuais foram preservados e associados ao novo planejamento.`);
        }
        
        if (!transaction) await t.commit();
        
        return { 
            message: `Distribuição para ${ano} concluída. ${feriasParaCriar.length} períodos planejados automaticamente e ${feriasManuais.length} preservados.`,
            registrosCriados: feriasParaCriar.length
        };
    } catch(error) {
        if (!transaction) await t.rollback();
        console.error("Erro na distribuição de férias. Transação revertida.", error);
        throw error;
    }
}

/**
 * Redistribui as férias para um grupo selecionado de funcionários dentro de um novo período.
 */
const redistribuirFeriasSelecionadas = async (dados) => {
    const { matriculas, dataInicio, dataFim, descricao } = dados;

    if (!matriculas || matriculas.length === 0) throw new Error("Nenhuma matrícula de funcionário foi fornecida.");
    if (!dataInicio || !isValid(parseISO(dataInicio))) throw new Error("A data de início para a redistribuição é obrigatória e inválida.");

    const t = await sequelize.transaction();
    const options = { transaction: t };

    try {
        const ano = getYear(parseISO(dataInicio));
        const feriadosDoAno = await getFeriadosNacionais(ano);

        const planejamentoAtivo = await Planejamento.findOne({ where: { ano, status: 'ativo' }, ...options });
        if (!planejamentoAtivo) throw new Error(`Nenhum planejamento ativo para o ano ${ano}.`);
        
        console.log(`[LOG REDISTRIBUIÇÃO] Removendo ${matriculas.length} férias antigas (não manuais) do planejamento ${planejamentoAtivo.id}.`);
        await Ferias.destroy({
            where: {
                matricula_funcionario: { [Op.in]: matriculas },
                planejamentoId: planejamentoAtivo.id,
                status: 'Planejada',
                ajuste_manual: false // Só remove as geradas automaticamente
            },
            ...options
        });
        
        const funcionariosParaRedistribuir = await Funcionario.findAll({
            where: { matricula: { [Op.in]: matriculas }, status: 'Ativo' },
            order: [['dth_limite_ferias', 'ASC']],
            ...options
        });

        if (funcionariosParaRedistribuir.length === 0) {
            await t.commit();
            return { message: "Nenhum funcionário ativo encontrado para as matrículas fornecidas." };
        }

        const outrasFerias = await Ferias.findAll({ where: { planejamentoId: planejamentoAtivo.id, matricula_funcionario: { [Op.notIn]: matriculas } }, ...options });
        const calendarioOcupacao = {};
        outrasFerias.forEach(f => {
            const dataRef = parseISO(f.data_inicio);
            const mes = dataRef.toLocaleString('pt-BR', { month: 'long' });
            const municipio = f.Funcionario?.municipio_local_trabalho || 'N/A';
            const chaveOcupacao = `${municipio}-${mes}`;
            if (!calendarioOcupacao[chaveOcupacao]) calendarioOcupacao[chaveOcupacao] = 0;
            calendarioOcupacao[chaveOcupacao]++;
        });

        const novasFeriasParaCriar = [];
        for (const funcionario of funcionariosParaRedistribuir) {
            const diasDeFerias = funcionario.saldo_dias_ferias;
            if (diasDeFerias <= 0) continue;

            let dataInicioEncontrada = false;
            let dataAtual = startOfDay(parseISO(dataInicio));
            const dataLimite = dataFim && isValid(parseISO(dataFim)) ? startOfDay(parseISO(dataFim)) : new Date(funcionario.dth_limite_ferias);

            while (!dataInicioEncontrada && dataAtual < dataLimite) {
                if (isDataValidaInicio(format(dataAtual, 'yyyy-MM-dd'), funcionario, feriadosDoAno)) {
                    const mes = dataAtual.toLocaleString('pt-BR', { month: 'long' });
                    const municipio = funcionario.municipio_local_trabalho || 'N/A';
                    const chaveOcupacao = `${municipio}-${mes}`;
                    if (!calendarioOcupacao[chaveOcupacao]) calendarioOcupacao[chaveOcupacao] = 0;
                    if (calendarioOcupacao[chaveOcupacao] < 5) {
                        const dataFimCalculada = addDays(dataAtual, diasDeFerias - 1);
                        novasFeriasParaCriar.push({
                            matricula_funcionario: funcionario.matricula,
                            planejamentoId: planejamentoAtivo.id,
                            data_inicio: format(dataAtual, 'yyyy-MM-dd'),
                            data_fim: format(dataFimCalculada, 'yyyy-MM-dd'),
                            qtd_dias: diasDeFerias,
                            periodo_aquisitivo_inicio: funcionario.periodo_aquisitivo_atual_inicio,
                            periodo_aquisitivo_fim: funcionario.periodo_aquisitivo_atual_fim,
                            status: 'Planejada',
                            observacao: descricao || 'Redistribuição em massa',
                            ajuste_manual: true // Marcado como ajuste manual
                        });
                        calendarioOcupacao[chaveOcupacao]++;
                        dataInicioEncontrada = true;
                    }
                }
                dataAtual = addDays(dataAtual, 1);
            }
        }

        if (novasFeriasParaCriar.length > 0) await Ferias.bulkCreate(novasFeriasParaCriar, options);
        await t.commit();
        return { message: `Redistribuição concluída. ${novasFeriasParaCriar.length} novos períodos de férias planejados.` };
    } catch (error) {
        await t.rollback();
        console.error("Erro na redistribuição de férias. Transação revertida.", error);
        throw error;
    }
};

/**
 * Cria um novo registro de férias, calculando a data de fim.
 */
const create = async (dadosFerias) => {
    const { matricula_funcionario, data_inicio, qtd_dias, ano_planejamento } = dadosFerias;
    if (!matricula_funcionario || !data_inicio || !qtd_dias || !ano_planejamento) {
        throw new Error("Matrícula, data de início, dias e ano do planejamento são obrigatórios.");
    }
    const planejamentoAtivo = await Planejamento.findOne({ where: { ano: ano_planejamento, status: 'ativo' } });
    if (!planejamentoAtivo) {
        throw new Error(`Nenhum planejamento ativo encontrado para o ano ${ano_planejamento}.`);
    }
    dadosFerias.planejamentoId = planejamentoAtivo.id;
    const dataInicioObj = new Date(`${data_inicio}T00:00:00`);
    const dataFimObj = addDays(dataInicioObj, parseInt(qtd_dias, 10) - 1);
    dadosFerias.data_fim = format(dataFimObj, 'yyyy-MM-dd');
    // ==========================================================
    // ALTERAÇÃO: Marca como ajuste manual
    // ==========================================================
    dadosFerias.ajuste_manual = true;
    return Ferias.create(dadosFerias);
};

/**
 * Busca todos os registros de férias com filtros.
 */
async function findAll(queryParams) {
    const includeClause = [ { model: Funcionario, required: true }, { model: Planejamento, required: false } ];
    const whereClause = {};
    if (queryParams.planejamento === 'ativo') {
        whereClause['$Planejamento.status$'] = 'ativo';
        includeClause[1].required = true;
    }
    return Ferias.findAll({ where: whereClause, include: includeClause, order: [['data_inicio', 'ASC']] });
}

/**
 * Atualiza um registro de férias.
 */
async function update(id, dados) {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    
    const novaQtdDias = dados.qtd_dias !== undefined ? dados.qtd_dias : feria.qtd_dias;
    const novaDataInicio = dados.data_inicio !== undefined ? dados.data_inicio : feria.data_inicio;
    
    if (dados.qtd_dias !== undefined || dados.data_inicio !== undefined) {
        const dataInicioObj = new Date(`${novaDataInicio}T00:00:00`);
        const dataFimObj = addDays(dataInicioObj, parseInt(novaQtdDias, 10) - 1);
        dados.data_fim = format(dataFimObj, 'yyyy-MM-dd');
    }
    // ==========================================================
    // ALTERAÇÃO: Marca como ajuste manual
    // ==========================================================
    dados.ajuste_manual = true;
    return feria.update(dados);
};

/**
 * Remove um registro de férias.
 */
const remove = async (id) => {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    return feria.destroy();
};

const bulkRemove = async (ids) => {
    if (!ids || ids.length === 0) throw new Error("Nenhum ID fornecido para exclusão.");
    await Ferias.destroy({ where: { id: { [Op.in]: ids } } });
    return { message: `${ids.length} registros de férias removidos com sucesso.` };
};


/**
 * Busca todos os registros de férias do planejamento ativo com filtros e paginação.
 */
const findAllPaginated = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const ano = parseInt(queryParams.ano, 10) || new Date().getFullYear();

    const planejamentoAtivo = await Planejamento.findOne({ where: { ano, status: 'ativo' } });
    if (!planejamentoAtivo) {
        return { data: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1, limit } };
    }

    const whereFuncionario = {};
    const whereFerias = { planejamentoId: planejamentoAtivo.id };

    if (queryParams.q) { whereFuncionario[Op.or] = [{ nome_funcionario: { [Op.iLike]: `%${queryParams.q}%` } }, { matricula: { [Op.iLike]: `%${queryParams.q}%` } }]; }
    if (queryParams.matricula) { whereFuncionario.matricula = { [Op.iLike]: `%${queryParams.matricula}%` }; }
    if (queryParams.status) { whereFuncionario.status = queryParams.status; }
    if (queryParams.categoria) { whereFuncionario.categoria = { [Op.iLike]: `%${queryParams.categoria}%` }; }
    if (queryParams.des_grupo_contrato) { whereFuncionario.des_grupo_contrato = { [Op.iLike]: `%${queryParams.des_grupo_contrato}%` }; }
    if (queryParams.municipio_local_trabalho) { whereFuncionario.municipio_local_trabalho = { [Op.iLike]: `%${queryParams.municipio_local_trabalho}%` }; }
    
    // ==========================================================
    // ALTERAÇÃO: Adicionados novos filtros
    // ==========================================================
    if (queryParams.escala) { whereFuncionario.escala = { [Op.iLike]: `%${queryParams.escala}%` }; }
    if (queryParams.sigla_local) { whereFuncionario.sigla_local = { [Op.iLike]: `%${queryParams.sigla_local}%` }; }
    if (queryParams.cliente) { whereFuncionario.cliente = { [Op.iLike]: `%${queryParams.cliente}%` }; }
    if (queryParams.contrato) { whereFuncionario.contrato = { [Op.iLike]: `%${queryParams.contrato}%` }; }

    if (queryParams.status_ferias) { whereFerias.status = queryParams.status_ferias; }
    if (queryParams.ferias_inicio_de && queryParams.ferias_inicio_ate) {
        whereFerias.data_inicio = { [Op.between]: [new Date(queryParams.ferias_inicio_de), new Date(queryParams.ferias_inicio_ate)] };
    } else if (queryParams.ferias_inicio_de) {
        whereFerias.data_inicio = { [Op.gte]: new Date(queryParams.ferias_inicio_de) };
    } else if (queryParams.ferias_inicio_ate) {
        whereFerias.data_inicio = { [Op.lte]: new Date(queryParams.ferias_inicio_ate) };
    }

    const { count, rows } = await Ferias.findAndCountAll({
        where: whereFerias,
        include: [{
            model: Funcionario,
            where: whereFuncionario,
            required: true
        }],
        order: [['data_inicio', 'ASC']],
        limit,
        offset,
    });

    const totalPages = Math.ceil(count / limit);
    return {
        data: rows,
        pagination: { totalItems: count, totalPages, currentPage: page, limit }
    };
};

module.exports = {
    recalcularPeriodoAquisitivo,
    distribuirFerias,
    redistribuirFeriasSelecionadas,
    findAllPaginated,
    create,
    update,
    remove,
    bulkRemove, 
    findAll
};