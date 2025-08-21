// src/features/ferias/ferias.service.js

const { Op } = require('sequelize');
const axios = require('axios');
const { Ferias, Funcionario, Planejamento, Afastamento } = require('../../models');
const { addYears, addMonths, addDays, differenceInDays, isWithinInterval, getDay, format } = require('date-fns');

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
        return diaDaSemana !== 0;
    }

    if (diaDaSemana === 6 || diaDaSemana === 0 || diaDaSemana === 5) {
        return false;
    }

    const diaSeguinte = format(addDays(dataChecagem, 1), 'yyyy-MM-dd');
    const doisDiasDepois = format(addDays(dataChecagem, 2), 'yyyy-MM-dd');

    if (feriados.includes(diaSeguinte) || feriados.includes(doisDiasDepois)) {
        return false;
    }
    
    return true;
};

/**
 * Orquestra a criação de um novo planejamento de férias para um ano.
 */
async function distribuirFerias(ano, descricao, transaction = null) {
    console.log(`[LOG FÉRIAS SERVICE] Iniciando distribuição de férias para o ano ${ano}...`);
    const options = transaction ? { transaction } : {};

    await Planejamento.update({ status: 'arquivado' }, { where: { ano, status: 'ativo' }, ...options });
    
    const novoPlanejamento = await Planejamento.create({
        ano,
        descricao: descricao || `Distribuição automática para ${ano}`,
        status: 'ativo'
    }, options);
    console.log(`[LOG FÉRIAS SERVICE] Novo planejamento ID ${novoPlanejamento.id} criado.`);

    const funcionariosElegiveis = await Funcionario.findAll({
        where: {
            status: 'Ativo',
            dth_limite_ferias: { [Op.not]: null },
            situacao_ferias_afastamento_hoje: { [Op.or]: [ { [Op.is]: null }, { [Op.notILike]: '%aviso prévio%' } ] }
        },
        include: [{ model: Afastamento, as: 'historicoAfastamentos', required: false }],
        order: [['dth_limite_ferias', 'ASC']],
        ...options
    });

    console.log(`[LOG FÉRIAS SERVICE] ${funcionariosElegiveis.length} funcionários elegíveis encontrados para o planejamento.`);
    
    if (funcionariosElegiveis.length === 0) {
        return { message: `Planejamento para ${ano} criado, mas nenhum funcionário era elegível para alocação automática.` };
    }

    const feriadosDoAno = await getFeriadosNacionais(ano);
    const feriasParaCriar = [];
    const calendarioOcupacao = {};
    const funcionariosExcluidos = [];

    for (const funcionario of funcionariosElegiveis) {
        let excluidoPorAfastamento = false;
        const hoje = new Date();
        if (funcionario.historicoAfastamentos && funcionario.historicoAfastamentos.length > 0) {
            for (const af of funcionario.historicoAfastamentos) {
                if (!af.data_fim || new Date(af.data_fim) > hoje) {
                    const inicioAfastamento = new Date(af.data_inicio);
                    const fimAfastamento = af.data_fim ? new Date(af.data_fim) : addDays(inicioAfastamento, 365);
                    const duracaoAfastamento = differenceInDays(fimAfastamento, inicioAfastamento);
                    if (duracaoAfastamento > 15) {
                        funcionariosExcluidos.push({ matricula: funcionario.matricula, nome: funcionario.nome_funcionario, motivo: `Afastamento ativo superior a 15 dias.` });
                        excluidoPorAfastamento = true;
                        break;
                    }
                }
            }
        }
        if (excluidoPorAfastamento) continue;

        const diasDeFerias = funcionario.saldo_dias_ferias;
        if (diasDeFerias <= 0) continue;

        let dataInicioEncontrada = false;
        let dataAtual = new Date() > new Date(funcionario.periodo_aquisitivo_atual_inicio) ? new Date() : new Date(funcionario.periodo_aquisitivo_atual_inicio);
        const dataLimite = new Date(funcionario.dth_limite_ferias);

        while (!dataInicioEncontrada && dataAtual < dataLimite) {
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
                        status: 'Planejada'
                    });
                    calendarioOcupacao[chaveOcupacao]++;
                    dataInicioEncontrada = true;
                }
            }
            dataAtual = addDays(dataAtual, 1);
        }
    }

    console.log(`[LOG FÉRIAS SERVICE] Lógica de distribuição finalizada. ${feriasParaCriar.length} registros de férias serão criados.`);

    if (feriasParaCriar.length > 0) {
        await Ferias.bulkCreate(feriasParaCriar, options);
        console.log(`[LOG FÉRIAS SERVICE] ${feriasParaCriar.length} registros de férias inseridos no banco.`);
    }

    return { 
        message: `Distribuição para ${ano} concluída. ${feriasParaCriar.length} períodos planejados.`,
        registrosCriados: feriasParaCriar.length,
        funcionariosExcluidos: funcionariosExcluidos
    };
}

/**
 * Cria um novo registro de férias, calculando a data de fim.
 */
async function create(dadosFerias) {
    const { matricula_funcionario, data_inicio, qtd_dias } = dadosFerias;
    if (!matricula_funcionario || !data_inicio || !qtd_dias) {
        throw new Error("Matrícula, data de início e quantidade de dias são obrigatórios.");
    }
    const dataInicioObj = new Date(`${data_inicio}T00:00:00`);
    const dataFimObj = addDays(dataInicioObj, parseInt(qtd_dias, 10) - 1);
    dadosFerias.data_fim = format(dataFimObj, 'yyyy-MM-dd');
    return Ferias.create(dadosFerias);
};

/**
 * Busca todos os registros de férias com filtros.
 */
async function findAll(queryParams) {
    const includeClause = [
        { model: Funcionario, required: true },
        { model: Planejamento, required: false }
    ];
    const whereClause = {};

    if (queryParams.planejamento === 'ativo') {
        whereClause['$Planejamento.status$'] = 'ativo';
        includeClause[1].required = true;
    }
    
    return Ferias.findAll({
        where: whereClause,
        include: includeClause,
        order: [['data_inicio', 'ASC']]
    });
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
    return feria.update(dados);
};

/**
 * Remove um registro de férias.
 */
async function remove(id) {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    return feria.destroy();
};

module.exports = {
    recalcularPeriodoAquisitivo,
    distribuirFerias,
    create,
    findAll,
    update,
    remove,
};