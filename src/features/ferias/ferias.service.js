// src/features/ferias/ferias.service.js

const { Op } = require('sequelize');
const axios = require('axios'); // Adicionado para chamadas HTTP
const { Ferias, Funcionario, Planejamento, Afastamento } = require('../../models');
const { addYears, addMonths, addDays, differenceInDays, isWithinInterval, getDay, format } = require('date-fns');

// --- FUNÇÃO AUXILIAR PARA API DE FERIADOS ---

/**
 * Busca os feriados nacionais de um determinado ano usando a BrasilAPI.
 * @param {number} ano - O ano para o qual buscar os feriados.
 * @returns {Promise<Array<string>>} Um array de strings com as datas dos feriados no formato 'YYYY-MM-DD'.
 */
async function getFeriadosNacionais(ano) {
    try {
        console.log(`Buscando feriados nacionais para o ano ${ano}...`);
        const response = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
        // A API retorna objetos { date: 'YYYY-MM-DD', name: 'Nome', type: 'national' }
        // Mapeamos para retornar apenas um array de datas em string.
        const feriados = response.data.map(feriado => feriado.date);
        console.log(`Feriados encontrados: ${feriados.join(', ')}`);
        return feriados;
    } catch (error) {
        console.error(`Falha ao buscar feriados da BrasilAPI para o ano ${ano}. Usando lista de fallback.`, error.message);
        // Fallback com feriados fixos caso a API falhe
        return [`${ano}-01-01`, `${ano}-04-21`, `${ano}-05-01`, `${ano}-09-07`, `${ano}-10-12`, `${ano}-11-02`, `${ano}-11-15`, `${ano}-12-25`];
    }
}


// --- FUNÇÃO CENTRAL DE REGRAS DE NEGÓCIO ---

/**
 * RECALCULA O PERÍODO AQUISITIVO E O SALDO DE FÉRIAS DE UM FUNCIONÁRIO.
 * Esta função segue as regras do PDF sobre afastamentos e faltas.
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
                
                if(diasDeAfastamentoDoencaNoPeriodo > 180) { // Regra: SUPERIOR a 6 meses
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

// --- LÓGICA DE DISTRIBUIÇÃO AUTOMÁTICA ---

/**
 * Função auxiliar para verificar se a data de início das férias é válida.
 * Segue a Regra 2 do PDF.
 */
function isDataValidaInicio(data, funcionario, feriados) {
    const dataChecagem = new Date(`${data}T00:00:00`); // Assegura que a data é local
    const diaDaSemana = getDay(dataChecagem); // Domingo é 0, Sábado é 6

    // Exceções para convenções coletivas (Regra 2.2)
    const convencoesExcecao = ['1-SEEACEPI', '10-SECAPI INTERIOR'];
    if (convencoesExcecao.includes(funcionario.convencao)) {
        return diaDaSemana !== 0; // Na exceção, só não pode no domingo.
    }

    // Regra Geral (Regra 2.1): não pode iniciar 2 dias antes de feriado ou DSR (domingo)
    const doisDiasDepois = addDays(dataChecagem, 2);
    
    // Verifica se a data atual é sexta (5) ou sábado (6)
    if (diaDaSemana === 5 || diaDaSemana === 6) {
        return false;
    }
    // Verifica se os próximos dois dias são feriados
    if (feriados.includes(format(addDays(dataChecagem, 1), 'yyyy-MM-dd')) || feriados.includes(format(doisDiasDepois, 'yyyy-MM-dd'))) {
        return false;
    }
    // Verifica se os próximos dois dias são domingo
    if (getDay(addDays(dataChecagem, 1)) === 0 || getDay(doisDiasDepois) === 0) {
        return false;
    }

    return true;
};

/**
 * Orquestra a criação de um novo planejamento de férias para um ano.
 * Segue as Regras do PDF.
 */
async function distribuirFerias(ano, descricao) {
    console.log(`Iniciando distribuição de férias para o ano ${ano}...`);

    await Planejamento.update({ status: 'arquivado' }, { where: { ano, status: 'ativo' } });
    
    const novoPlanejamento = await Planejamento.create({
        ano,
        descricao: descricao || `Distribuição automática para ${ano}`,
        status: 'ativo'
    });

    const funcionariosElegiveis = await Funcionario.findAll({
        where: {
            status: 'Ativo',
            dth_limite_ferias: { [Op.not]: null },
            // Regra 4: Não incluir colaboradores em "Aviso Prévio"
            afastamento: { [Op.notIn]: ['Aviso Prévio', 'AVISO PREVIO'] }
        },
        order: [['dth_limite_ferias', 'ASC']]
    });

    console.log(`${funcionariosElegiveis.length} funcionários elegíveis encontrados.`);
    
    // INTEGRAÇÃO: Busca feriados dinamicamente
    const feriadosDoAno = await getFeriadosNacionais(ano);
    const feriasParaCriar = [];
    const calendarioOcupacao = {}; // Ex: { 'Teresina-Janeiro': 2, 'Parnaiba-Fevereiro': 1 }

    for (const funcionario of funcionariosElegiveis) {
        const diasDeFerias = funcionario.saldo_dias_ferias;
        if (diasDeFerias <= 0) continue;

        let dataInicioEncontrada = false;
        // Inicia a busca a partir do início do período aquisitivo (ou hoje, se for posterior)
        let dataAtual = new Date() > new Date(funcionario.periodo_aquisitivo_atual_inicio) ? new Date() : new Date(funcionario.periodo_aquisitivo_atual_inicio);
        const dataLimite = new Date(funcionario.dth_limite_ferias);

        while (!dataInicioEncontrada && dataAtual < dataLimite) {
            if (isDataValidaInicio(format(dataAtual, 'yyyy-MM-dd'), funcionario, feriadosDoAno)) {
                const mes = dataAtual.toLocaleString('pt-BR', { month: 'long' });
                const municipio = funcionario.municipio_local_trabalho || 'N/A';
                const chaveOcupacao = `${municipio}-${mes}`;
                
                if (!calendarioOcupacao[chaveOcupacao]) {
                    calendarioOcupacao[chaveOcupacao] = 0;
                }
                
                // Regra 5: Limite de cobertura (exemplo: 5 por município/mês, pode ser parametrizado)
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

        if (!dataInicioEncontrada) {
            console.warn(`AVISO: Não foi possível alocar férias para ${funcionario.matricula} (${funcionario.nome_funcionario}) antes do prazo limite.`);
        }
    }

    if (feriasParaCriar.length > 0) {
        await Ferias.bulkCreate(feriasParaCriar);
        console.log(`${feriasParaCriar.length} registros de férias foram criados e associados ao planejamento ${novoPlanejamento.id}.`);
    }

    return { message: `Distribuição para ${ano} concluída. ${feriasParaCriar.length} períodos planejados.` };
}

// --- CRUD E OUTRAS FUNCIONALIDADES DE FÉRIAS ---

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
        { model: Planejamento, required: false } // Alterado para false para poder buscar férias não planejadas
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
    
    // Se a data de início ou a qtd de dias for alterada, recalcula a data de fim.
    const novaQtdDias = dados.qtd_dias || feria.qtd_dias;
    const novaDataInicio = dados.data_inicio || feria.data_inicio;
    
    if (dados.qtd_dias || dados.data_inicio) {
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