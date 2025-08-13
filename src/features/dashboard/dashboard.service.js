// src/features/dashboard/dashboard.service.js
const { Funcionario, Planejamento, Ferias } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');
const { addDays, startOfYear, endOfYear } = require('date-fns');

const getSummaryData = async () => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    // =================================================================
    // DADOS GERAIS (CARDS PRINCIPAIS)
    // =================================================================
    
    // 1. Total de Funcionários Ativos
    const totalFuncionarios = await Funcionario.count({ where: { status: 'Ativo' } });

    // 2. Planejamento Ativo
    const planejamentoAtivo = await Planejamento.findOne({ 
        where: { status: 'ativo' },
        order: [['ano', 'DESC'], ['criado_em', 'DESC']] 
    });

    // 3. Funcionários com Férias Já Planejadas no Planejamento Ativo
    let funcionariosComFeriasPlanejadas = 0;
    if (planejamentoAtivo) {
        funcionariosComFeriasPlanejadas = await Ferias.count({
            where: { planejamentoId: planejamentoAtivo.id },
            distinct: true,
            col: 'matricula_funcionario'
        });
    }

    // 4. Percentual do quadro de funcionários com férias já planejadas
    const percentualPlanejado = totalFuncionarios > 0 
        ? ((funcionariosComFeriasPlanejadas / totalFuncionarios) * 100).toFixed(1) 
        : 0;

    // =================================================================
    // ITENS DE AÇÃO (ALERTAS E PONTOS DE ATENÇÃO)
    // =================================================================
    
    // 1. Férias Vencidas (data limite no passado)
    const feriasVencidas = await Funcionario.count({
        where: { 
            status: 'Ativo',
            dth_limite_ferias: { [Op.lt]: hoje } 
        }
    });

    // 2. Risco Iminente (data limite nos próximos 30 dias)
    const riscoIminente = await Funcionario.count({
        where: { 
            status: 'Ativo',
            dth_limite_ferias: { [Op.between]: [hoje, addDays(hoje, 30)] } 
        }
    });
    
    // 3. Risco a Médio Prazo (data limite entre 31 e 90 dias)
    const riscoMedioPrazo = await Funcionario.count({
        where: {
            status: 'Ativo',
            dth_limite_ferias: { [Op.between]: [addDays(hoje, 31), addDays(hoje, 90)] }
        }
    });

    // 4. Solicitações Pendentes (se você implementar esse status)
    const solicitacoesPendentes = await Ferias.count({
        where: { status: 'Solicitada' }
    });

    // =================================================================
    // DADOS PARA GRÁFICOS (DISTRIBUIÇÃO MENSAL)
    // =================================================================

    // Contagem de funcionários que INICIAM férias em cada mês do ano atual (do planejamento ativo)
    let distribuicaoMensal = [];
    if (planejamentoAtivo) {
        const feriasDoAno = await Ferias.findAll({
            where: {
                planejamentoId: planejamentoAtivo.id,
                data_inicio: {
                    [Op.between]: [startOfYear(hoje), endOfYear(hoje)]
                }
            },
            attributes: [
                [fn('to_char', col('data_inicio'), 'MM'), 'mes'], // Extrai o mês como '01', '02', etc.
                [fn('count', col('id')), 'total']
            ],
            group: ['mes'],
            order: [[literal('mes'), 'ASC']],
            raw: true
        });
        
        // Mapeia os resultados para um formato amigável para gráficos
        const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        distribuicaoMensal = mesesDoAno.map((nomeMes, index) => {
            const mesNumero = String(index + 1).padStart(2, '0');
            const mesData = feriasDoAno.find(item => item.mes === mesNumero);
            return {
                mes: nomeMes,
                total: mesData ? parseInt(mesData.total, 10) : 0
            };
        });
    }


    // Monta o objeto final da resposta
    return {
        cardsPrincipais: {
            totalFuncionarios,
            planejamentoAtivo: planejamentoAtivo ? `Ano ${planejamentoAtivo.ano}` : 'Nenhum',
            funcionariosComFeriasPlanejadas,
            percentualPlanejado: `${percentualPlanejado}%`
        },
        itensDeAcao: [
            { title: 'Férias Vencidas', count: feriasVencidas, link: '/funcionarios?filtro=vencidas', variant: 'danger' },
            { title: 'Risco Iminente (30 dias)', count: riscoIminente, link: '/funcionarios?filtro=risco_iminente', variant: 'warning' },
            { title: 'A Vencer (31-90 dias)', count: riscoMedioPrazo, link: '/funcionarios?filtro=risco_medio', variant: 'info' }, // Adicionado novo filtro
            { title: 'Solicitações Pendentes', count: solicitacoesPendentes, link: '/planejamento?filtro=pendentes', variant: 'neutral' },
        ],
        distribuicaoMensal
    };
};

module.exports = { getSummaryData };