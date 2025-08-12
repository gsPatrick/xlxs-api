// src/features/dashboard/dashboard.service.js
const { Funcionario, Planejamento, Ferias } = require('../../models');
const { Op } = require('sequelize');
const { addDays } = require('date-fns');

const getSummaryData = async () => {
    const hoje = new Date();
    const dataLimiteRisco = addDays(hoje, 90);
    const dataLimiteRiscoIminente = addDays(hoje, 30);

    // 1. Total de Funcionários Ativos
    const totalFuncionarios = await Funcionario.count({ where: { status: 'Ativo' } });

    // 2. Planejamento Ativo (simplesmente pega o mais recente)
    const planejamentoAtivo = await Planejamento.findOne({ 
        where: { status: 'ativo' },
        order: [['criado_em', 'DESC']] 
    });

    // 3. Vencimentos Próximos (em 90 dias)
    const vencimentosProximos = await Funcionario.count({
        where: { dth_limite_ferias: { [Op.between]: [hoje, dataLimiteRisco] } }
    });
    
    // 4. Férias Vencidas
    const feriasVencidas = await Funcionario.count({
        where: { dth_limite_ferias: { [Op.lt]: hoje } }
    });

    // 5. Risco Iminente (em 30 dias)
     const riscoIminente = await Funcionario.count({
        where: { dth_limite_ferias: { [Op.between]: [hoje, dataLimiteRiscoIminente] } }
    });

    // 6. Solicitações Pendentes (exemplo)
    const solicitacoesPendentes = await Ferias.count({
        where: { status: 'Solicitada' }
    });

    return {
        totalFuncionarios,
        planejamentoAtivo: planejamentoAtivo ? `${planejamentoAtivo.ano} - V${planejamentoAtivo.id}` : 'Nenhum',
        vencimentosProximos,
        actionItems: [
            { title: 'Férias Vencidas', count: feriasVencidas, link: '/funcionarios?filtro=vencidas', variant: 'danger' },
            { title: 'Períodos a Vencer (em 30 dias)', count: riscoIminente, link: '/funcionarios?filtro=risco_iminente', variant: 'warning' },
            { title: 'Solicitações Pendentes de Aprovação', count: solicitacoesPendentes, link: '/planejamento?filtro=pendentes', variant: 'info' },
        ]
    };
};

module.exports = { getSummaryData };