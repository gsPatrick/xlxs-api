// src/features/dashboard/dashboard.service.js
const { Funcionario, Planejamento, Ferias } = require('../../models');
const { Op, fn, col, literal } = require('sequelize'); // As funções já são importadas corretamente
const { addDays, startOfYear, endOfYear } = require('date-fns');

const getSummaryData = async () => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    // =================================================================
    // DADOS GERAIS (CARDS PRINCIPAIS)
    // =================================================================
    
    const totalFuncionarios = await Funcionario.count({ where: { status: 'Ativo' } });

    const planejamentoAtivo = await Planejamento.findOne({ 
        where: { status: 'ativo' },
        order: [['ano', 'DESC'], ['criado_em', 'DESC']] 
    });

    let funcionariosComFeriasPlanejadas = 0;
    if (planejamentoAtivo) {
        funcionariosComFeriasPlanejadas = await Ferias.count({
            where: { planejamentoId: planejamentoAtivo.id },
            distinct: true,
            col: 'matricula_funcionario'
        });
    }

    const percentualPlanejado = totalFuncionarios > 0 
        ? ((funcionariosComFeriasPlanejadas / totalFuncionarios) * 100).toFixed(1) 
        : 0;

    // =================================================================
    // ITENS DE AÇÃO (ALERTAS E PONTOS DE ATENÇÃO)
    // =================================================================
    
    const feriasVencidas = await Funcionario.count({
        where: { 
            status: 'Ativo',
            dth_limite_ferias: { [Op.lt]: hoje } 
        }
    });

    const riscoIminente = await Funcionario.count({
        where: { 
            status: 'Ativo',
            dth_limite_ferias: { [Op.between]: [hoje, addDays(hoje, 30)] } 
        }
    });
    
    const riscoMedioPrazo = await Funcionario.count({
        where: {
            status: 'Ativo',
            dth_limite_ferias: { [Op.between]: [addDays(hoje, 31), addDays(hoje, 90)] }
        }
    });

    const solicitacoesPendentes = await Ferias.count({
        where: { status: 'Solicitada' }
    });

    const necessidadeSubstituicao = await Ferias.count({
        where: {
            necessidade_substituicao: true,
            status: { [Op.in]: ['Planejada', 'Confirmada'] },
            data_inicio: { [Op.gte]: hoje }
        }
    });
    
    let pendentesDeSubstituto = 0;
    if (planejamentoAtivo) {
        pendentesDeSubstituto = await Ferias.count({
            where: {
                planejamentoId: planejamentoAtivo.id,
                status: { [Op.in]: ['Planejada', 'Confirmada'] },
                data_inicio: { [Op.gte]: hoje },
                necessidade_substituicao: true,
                observacao: {
                    [Op.iLike]: '%Pendente de alocação de substituto%'
                }
            }
        });
    }

    // =================================================================
    // DADOS PARA GRÁFICOS (DISTRIBUIÇÃO MENSAL)
    // =================================================================

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
                // CORREÇÃO: Removido 'Op.' antes de fn, col e literal.
                [fn('to_char', col('data_inicio'), 'MM'), 'mes'],
                [fn('count', col('id')), 'total']
            ],
            group: ['mes'],
            order: [[literal('mes'), 'ASC']],
            raw: true
        });
        
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

    const itensDeAcao = [
        { title: 'Férias Vencidas', count: feriasVencidas, link: '/funcionarios?filtro=vencidas', variant: 'danger' },
        { title: 'Risco Iminente (30 dias)', count: riscoIminente, link: '/funcionarios?filtro=risco_iminente', variant: 'warning' },
        { title: 'A Vencer (31-90 dias)', count: riscoMedioPrazo, link: '/funcionarios?filtro=risco_medio', variant: 'info' },
        { title: 'Necessitam Substituição', count: necessidadeSubstituicao, link: '/planejamento?filtro=substituicao', variant: 'info' },
        { title: 'Solicitações Pendentes', count: solicitacoesPendentes, link: '/planejamento?filtro=pendentes', variant: 'neutral' },
    ];
    
    if (pendentesDeSubstituto > 0) {
        itensDeAcao.push({ 
            title: 'Pendente de Substituto', 
            count: pendentesDeSubstituto, 
            link: '/planejamento?filtro=pendente_substituto',
            variant: 'warning' 
        });
    }


    return {
        cardsPrincipais: {
            totalFuncionarios,
            planejamentoAtivo: planejamentoAtivo ? `Ano ${planejamentoAtivo.ano}` : 'Nenhum',
            funcionariosComFeriasPlanejadas,
            percentualPlanejado: `${percentualPlanejado}%`
        },
        itensDeAcao,
        distribuicaoMensal
    };
};

module.exports = { getSummaryData };