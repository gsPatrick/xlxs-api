// src/features/ferias/ferias.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, Planejamento } = require('../../models');
const { addYears, addMonths, addDays, differenceInDays, isWithinInterval, getDay, format } = require('date-fns');

// --- FUNÇÃO CENTRAL DE REGRAS DE NEGÓCIO ---

/**
 * RECALCULA O PERÍODO AQUISITIVO E O SALDO DE FÉRIAS DE UM FUNCIONÁRIO.
 * Esta função é o cérebro do sistema para conformidade com as regras de férias.
 * É acionada sempre que um afastamento ou falta é registrado/modificado.
 * 
 * @param {string} matricula - A matrícula do funcionário a ser recalculado.
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

    let diasDeAfastamentoDoenca = 0;
    let diasDeAfastamentoSuspensao = 0;

    if (funcionario.historicoAfastamentos) {
        for (const af of funcionario.historicoAfastamentos) {
            if (!af.impacta_ferias) continue;

            const intervaloAfastamento = { start: new Date(af.data_inicio), end: new Date(af.data_fim || hoje) };
            const intervaloPeriodo = { start: new Date(periodoBaseInicio), end: new Date(periodoBaseFim) };

            if (isWithinInterval(intervaloAfastamento.start, intervaloPeriodo) || isWithinInterval(intervaloAfastamento.end, intervaloPeriodo)) {
                const diasNoPeriodo = differenceInDays(intervaloAfastamento.end, intervaloAfastamento.start) + 1;
                
                if (af.motivo.toLowerCase().includes('doença') || af.motivo.toLowerCase().includes('acidente')) {
                    diasDeAfastamentoDoenca += diasNoPeriodo;
                }
                if (af.motivo.toLowerCase().includes('licença não remunerada') || af.motivo.toLowerCase().includes('cárcere')) {
                    diasDeAfastamentoSuspensao += diasNoPeriodo;
                }
            }
        }
    }

    if (diasDeAfastamentoDoenca > 180) {
        const ultimoAfastamentoRelevante = funcionario.historicoAfastamentos
            .filter(af => af.motivo.toLowerCase().includes('doença'))
            .sort((a, b) => new Date(b.data_fim) - new Date(a.data_fim))[0];

        const dataRetorno = addDays(new Date(ultimoAfastamentoRelevante.data_fim), 1);
        
        funcionario.periodo_aquisitivo_atual_inicio = dataRetorno;
        funcionario.periodo_aquisitivo_atual_fim = addDays(addYears(dataRetorno, 1), -1);
    } else {
        const novoFimPeriodo = addDays(periodoBaseFim, diasDeAfastamentoSuspensao);
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

// Função auxiliar para verificar se a data de início é válida
function isDataValidaInicio(data, funcionario, feriados) {
    const dataChecagem = new Date(data);
    const diaDaSemana = getDay(dataChecagem); // Domingo é 0

    // Regra 2 - Exceções
    const convencoesExcecao = ['1-SEEACEPI', '10-SECAPI INTERIOR'];
    if (convencoesExcecao.includes(funcionario.convencao)) {
        return diaDaSemana !== 0; // Na exceção, só não pode no domingo.
    }

    // Regra 2 - Geral: não pode iniciar 2 dias antes de feriado ou DSR (domingo)
    if (diaDaSemana === 5 || diaDaSemana === 6) { // Sexta ou Sábado
        return false;
    }
    const diaSeguinte = format(addDays(dataChecagem, 1), 'yyyy-MM-dd');
    const doisDiasDepois = format(addDays(dataChecagem, 2), 'yyyy-MM-dd');
    if (feriados.includes(diaSeguinte) || feriados.includes(doisDiasDepois)) {
        return false;
    }
    return true;
};

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
            afastamento: { [Op.notIn]: ['Aviso Prévio', 'AVISO PREVIO'] }
        },
        order: [['dth_limite_ferias', 'ASC']]
    });

    console.log(`${funcionariosElegiveis.length} funcionários elegíveis encontrados.`);
    
    const feriadosDoAno = [`${ano}-01-01`, `${ano}-04-21`, `${ano}-05-01`, `${ano}-09-07`, `${ano}-10-12`, `${ano}-11-02`, `${ano}-11-15`, `${ano}-12-25`];
    const feriasParaCriar = [];
    const calendarioOcupacao = {};

    for (const funcionario of funcionariosElegiveis) {
        const diasDeFerias = funcionario.saldo_dias_ferias;
        if (diasDeFerias <= 0) continue;

        let dataInicioEncontrada = false;
        let dataAtual = new Date(funcionario.periodo_aquisitivo_atual_inicio);
        const dataLimite = new Date(funcionario.dth_limite_ferias);

        while (!dataInicioEncontrada && dataAtual < dataLimite) {
            if (isDataValidaInicio(dataAtual, funcionario, feriadosDoAno)) {
                const mes = dataAtual.getMonth();
                const municipio = funcionario.municipio_local_trabalho;
                const chaveOcupacao = `${municipio}-${mes}`;
                
                if (!calendarioOcupacao[chaveOcupacao]) {
                    calendarioOcupacao[chaveOcupacao] = 0;
                }

                if (calendarioOcupacao[chaveOcupacao] < 5) { // Limite de 5 por município/mês
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
            console.warn(`AVISO: Não foi possível alocar férias para ${funcionario.matricula} antes do prazo.`);
        }
    }

    if (feriasParaCriar.length > 0) {
        await Ferias.bulkCreate(feriasParaCriar);
        console.log(`${feriasParaCriar.length} registros de férias foram criados.`);
    }

    return { message: `Distribuição para ${ano} concluída. ${feriasParaCriar.length} períodos planejados.` };
}

// --- CRUD E OUTRAS FUNCIONALIDADES DE FÉRIAS ---

async function create(dadosFerias) {
    return Ferias.create(dadosFerias);
};

async function findAll(queryParams) {
    const whereClause = {};
    if (queryParams.planejamento === 'ativo') {
        whereClause['$Planejamento.status$'] = 'ativo';
    }
    return Ferias.findAll({
        where: whereClause,
        include: [
            { model: Funcionario, required: true },
            { model: Planejamento, required: true }
        ],
        order: [['data_inicio', 'ASC']]
    });
}

async function update(id, dados) {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    return feria.update(dados);
};

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