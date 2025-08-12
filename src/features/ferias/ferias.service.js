// src/features/ferias/ferias.service.js

const { Op } = require('sequelize');
const { Ferias, Funcionario, Planejamento, Afastamento } = require('../../models');
const { addYears, addMonths, addDays, differenceInDays, isWithinInterval } = require('date-fns');

// Esta função permanecerá aqui, pois é o "cérebro" das regras de férias
async function recalcularPeriodoAquisitivo(matricula) {
    // ... (toda a lógica de recálculo que já implementamos) ...
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

    for (const af of funcionario.historicoAfastamentos) {
        if (!af.impacta_ferias) continue;
        const intervaloAfastamento = { start: af.data_inicio, end: af.data_fim || hoje };
        const intervaloPeriodo = { start: periodoBaseInicio, end: periodoBaseFim };
        if (isWithinInterval(intervaloAfastamento.start, intervaloPeriodo) || isWithinInterval(intervaloAfastamento.end, intervaloPeriodo)) {
            if (af.motivo.toLowerCase().includes('doença') || af.motivo.toLowerCase().includes('acidente')) {
                diasDeAfastamentoDoenca += differenceInDays(intervaloAfastamento.end, intervaloAfastamento.start) + 1;
            }
            if (af.motivo.toLowerCase().includes('licença não remunerada') || af.motivo.toLowerCase().includes('cárcere')) {
                diasDeAfastamentoSuspensao += differenceInDays(intervaloAfastamento.end, intervaloAfastamento.start) + 1;
            }
        }
    }

    if (diasDeAfastamentoDoenca > 180) {
        const ultimoAfastamento = funcionario.historicoAfastamentos[funcionario.historicoAfastamentos.length - 1];
        const dataRetorno = addDays(new Date(ultimoAfastamento.data_fim), 1);
        
        funcionario.periodo_aquisitivo_atual_inicio = dataRetorno;
        funcionario.periodo_aquisitivo_atual_fim = addDays(addYears(dataRetorno, 1), -1);
        funcionario.dth_limite_ferias = addMonths(funcionario.periodo_aquisitivo_atual_fim, 11);
    } else {
        const novoFimPeriodo = addDays(periodoBaseFim, diasDeAfastamentoSuspensao);
        
        funcionario.periodo_aquisitivo_atual_inicio = periodoBaseInicio;
        funcionario.periodo_aquisitivo_atual_fim = novoFimPeriodo;
        funcionario.dth_limite_ferias = addMonths(novoFimPeriodo, 11);
    }
    
    const faltas = funcionario.faltas_injustificadas_periodo || 0;
    if (faltas <= 5) funcionario.saldo_dias_ferias = 30;
    else if (faltas <= 14) funcionario.saldo_dias_ferias = 24;
    else if (faltas <= 23) funcionario.saldo_dias_ferias = 18;
    else if (faltas <= 32) funcionario.saldo_dias_ferias = 12;
    else funcionario.saldo_dias_ferias = 0;

    await funcionario.save();
    return funcionario;
}

// Lógica de listagem de férias
async function findAll(queryParams) {
    const whereClause = {};
    if (queryParams.planejamento === 'ativo') {
        // Acessa o modelo Planejamento através da associação
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

// Lógica de distribuição de férias
async function distribuirFerias(ano, descricao) {
    await Planejamento.update({ status: 'arquivado' }, { where: { ano, status: 'ativo' } });
    const novoPlanejamento = await Planejamento.create({ ano, descricao, status: 'ativo' });
    
    // ... lógica de distribuição ...
    
    return { message: `Novo planejamento para ${ano} criado com sucesso.` };
}


module.exports = {
    recalcularPeriodoAquisitivo,
    findAll,
    distribuirFerias,
};