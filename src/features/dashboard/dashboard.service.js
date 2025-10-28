// src/features/dashboard/dashboard.service.js
const { Funcionario, Planejamento, Ferias } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');
const { addDays } = require('date-fns');

const getSummaryData = async (queryParams) => {
    const hoje = new Date();
    const { year, ...filters } = queryParams;

    // =================================================================
    // 1. CONSTRUIR CLÁUSULA DE FILTRO DINÂMICA PARA FUNCIONÁRIOS
    // =================================================================
    const whereClauseFuncionario = { status: 'Ativo' }; // Sempre buscar apenas ativos como base
    if (filters) {
        for (const key in filters) {
            // Garante que o valor do filtro não seja nulo ou vazio
            if (filters[key]) {
                // Usamos iLike para buscas parciais e insensíveis a maiúsculas/minúsculas
                whereClauseFuncionario[key] = { [Op.iLike]: `%${filters[key]}%` };
            }
        }
    }

    // =================================================================
    // 2. SELECIONAR O PLANEJAMENTO (COM BASE APENAS NO ANO)
    // =================================================================
    let planejamentoSelecionado = null;
    if (year) {
        const anoNumero = parseInt(year, 10);
        planejamentoSelecionado = await Planejamento.findOne({ where: { status: 'ativo', ano: anoNumero } }) ||
                               await Planejamento.findOne({ where: { status: 'arquivado', ano: anoNumero }, order: [['criado_em', 'DESC']] });
    } else {
        planejamentoSelecionado = await Planejamento.findOne({ where: { status: 'ativo' }, order: [['ano', 'DESC'], ['criado_em', 'DESC']] });
    }
    const anoDoPlanejamento = planejamentoSelecionado?.ano || parseInt(year, 10) || new Date().getFullYear();

    // =================================================================
    // 3. CALCULAR MÉTRICAS APLICANDO OS FILTROS
    // =================================================================
    
    // Cards Principais
    const totalFuncionarios = await Funcionario.count({ where: whereClauseFuncionario });

    let funcionariosComFeriasPlanejadas = 0;
    if (planejamentoSelecionado) {
        funcionariosComFeriasPlanejadas = await Ferias.count({
            distinct: true,
            col: 'matricula_funcionario',
            where: { planejamentoId: planejamentoSelecionado.id },
            include: [{
                model: Funcionario,
                where: whereClauseFuncionario,
                attributes: [], // Não precisamos dos atributos do funcionário, só do filtro
                required: true
            }]
        });
    }

    const percentualPlanejado = totalFuncionarios > 0 
        ? ((funcionariosComFeriasPlanejadas / totalFuncionarios) * 100).toFixed(1) 
        : 0;

    // Itens de Ação (também usam o filtro)
    const feriasVencidas = await Funcionario.count({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.lt]: hoje } } });
    const riscoIminente = await Funcionario.count({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.between]: [hoje, addDays(hoje, 30)] } } });
    const riscoMedioPrazo = await Funcionario.count({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.between]: [addDays(hoje, 31), addDays(hoje, 90)] } } });

    // Itens de Ação para Férias (usando include para filtrar)
    const solicitacoesPendentes = await Ferias.count({
        where: { status: 'Solicitada' },
        include: [{ model: Funcionario, where: whereClauseFuncionario, attributes: [], required: true }]
    });

    const necessidadeSubstituicao = await Ferias.count({
        where: { necessidade_substituicao: true, status: { [Op.in]: ['Planejada', 'Confirmada'] }, data_inicio: { [Op.gte]: hoje } },
        include: [{ model: Funcionario, where: whereClauseFuncionario, attributes: [], required: true }]
    });
    
    let pendentesDeSubstituto = 0;
    if (planejamentoSelecionado) {
        pendentesDeSubstituto = await Ferias.count({
            where: { 
                planejamentoId: planejamentoSelecionado.id, 
                status: { [Op.in]: ['Planejada', 'Confirmada'] }, 
                data_inicio: { [Op.gte]: hoje }, 
                necessidade_substituicao: true, 
                observacao: { [Op.iLike]: '%Pendente de alocação%' } 
            },
            include: [{ model: Funcionario, where: whereClauseFuncionario, attributes: [], required: true }]
        });
    }

    // Gráfico de Distribuição (também usa include para filtrar)
    let distribuicaoMensal = [];
    if (planejamentoSelecionado) {
        const feriasDoAno = await Ferias.findAll({
            where: { planejamentoId: planejamentoSelecionado.id },
            include: [{ model: Funcionario, where: whereClauseFuncionario, attributes: [], required: true }],
            attributes: [ [fn('to_char', col('data_inicio'), 'MM'), 'mes'], [fn('count', col('Ferias.id')), 'total'] ],
            group: ['mes'],
            order: [[literal('mes'), 'ASC']],
            raw: true
        });
        
        const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        distribuicaoMensal = mesesDoAno.map((nomeMes, index) => {
            const mesNumero = String(index + 1).padStart(2, '0');
            const mesData = feriasDoAno.find(item => item.mes === mesNumero);
            return { mes: nomeMes, total: mesData ? parseInt(mesData.total, 10) : 0 };
        });
    }

    // Montagem final do objeto de resposta
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
            link: `/planejamento?ano=${anoDoPlanejamento}`,
            variant: 'warning' 
        });
    }

    return {
        cardsPrincipais: {
            totalFuncionarios,
            planejamentoAtivo: planejamentoSelecionado ? `Ano ${planejamentoSelecionado.ano}` : 'Nenhum',
            funcionariosComFeriasPlanejadas,
            percentualPlanejado: `${percentualPlanejado}%`
        },
        itensDeAcao,
        distribuicaoMensal
    };
};

module.exports = { getSummaryData };