// src/features/dashboard/dashboard.service.js
const { Funcionario, Planejamento, Ferias } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');
const { addDays } = require('date-fns');

const getSummaryData = async (queryParams) => {
    const hoje = new Date();
    const { year, ...filters } = queryParams;

    // 1. CONSTRUIR CLÁUSULA DE FILTRO DINÂMICA PARA FUNCIONÁRIOS
const whereClauseFuncionario = { status: 'Ativo' };
if (filters) {
    for (const key in filters) {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '' && filters[key].length > 0) {
            if (key === 'categoria' && Array.isArray(filters[key])) {
                // Lógica para Múltipla Seleção de Categoria
                whereClauseFuncionario[key] = { [Op.in]: filters[key] };
            } else if (['sigla_local', 'contrato', 'cliente', 'des_grupo_contrato', 'municipio_local_trabalho'].includes(key)) {
                // Lógica para os novos filtros
                whereClauseFuncionario[key] = { [Op.iLike]: `%${filters[key]}%` };
            }
        }
    }
}

    // 2. SELECIONAR O PLANEJAMENTO
    let planejamentoSelecionado = null;
    if (year) {
        // Lógica para quando um ano específico É fornecido
        const anoNumero = parseInt(year, 10);
        planejamentoSelecionado = await Planejamento.findOne({ where: { status: 'ativo', ano: anoNumero } }) ||
                               await Planejamento.findOne({ where: { status: 'arquivado', ano: anoNumero }, order: [['criado_em', 'DESC']] });
    } else {
        // Lógica para quando NENHUM ano é fornecido (carregamento inicial)
        // Busca pelo planejamento de maior ano, dando preferência ao status 'ativo'.
        planejamentoSelecionado = await Planejamento.findOne({
            order: [
                ['ano', 'DESC'],      // 1º Critério: Ano mais recente primeiro
                ['status', 'ASC'],    // 2º Critério: 'ativo' vem antes de 'arquivado'
                ['criado_em', 'DESC'] // 3º Critério: Desempate pela data de criação
            ]
        });
    }
    const anoDoPlanejamento = planejamentoSelecionado?.ano || parseInt(year, 10) || new Date().getFullYear();

    // 3. CALCULAR MÉTRICAS (RETORNANDO COUNT E LISTA DE FUNCIONÁRIOS)
    
    // Total de Funcionários
    const [totalFuncionariosCount, totalFuncionariosLista] = await Promise.all([
        Funcionario.count({ where: whereClauseFuncionario }),
        Funcionario.findAll({ where: whereClauseFuncionario, attributes: ['matricula', 'nome_funcionario'], raw: true })
    ]);

    // Funcionários com Férias Planejadas
    let planejadosResult = { count: 0, funcionarios: [] };
    if (planejamentoSelecionado) {
        const feriasPlanejadas = await Ferias.findAll({
            where: { planejamentoId: planejamentoSelecionado.id },
            include: [{
                model: Funcionario,
                where: whereClauseFuncionario,
                attributes: ['matricula', 'nome_funcionario'],
                required: true
            }],
            attributes: []
        });
        const funcionariosUnicos = Array.from(new Map(feriasPlanejadas.map(f => f.Funcionario).map(func => [func.matricula, func])).values());
        planejadosResult = {
            count: funcionariosUnicos.length,
            funcionarios: funcionariosUnicos.map(f => f.get({ plain: true }))
        };
    }

    const percentualPlanejado = totalFuncionariosCount > 0 ? ((planejadosResult.count / totalFuncionariosCount) * 100).toFixed(1) : 0;

    // Itens de Ação
    const [feriasVencidasResult, riscoIminenteResult, riscoMedioPrazoResult] = await Promise.all([
        Funcionario.findAndCountAll({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.lt]: hoje } }, attributes: ['matricula', 'nome_funcionario'], raw: true }),
        Funcionario.findAndCountAll({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.between]: [hoje, addDays(hoje, 30)] } }, attributes: ['matricula', 'nome_funcionario'], raw: true }),
        Funcionario.findAndCountAll({ where: { ...whereClauseFuncionario, dth_limite_ferias: { [Op.between]: [addDays(hoje, 31), addDays(hoje, 90)] } }, attributes: ['matricula', 'nome_funcionario'], raw: true })
    ]);

    const getUniqueFuncionariosFromFerias = (feriasRecords) => Array.from(new Map(feriasRecords.map(f => f.Funcionario).map(func => [func.matricula, func.get({ plain: true })])).values());
    
    const [solicitacoesPendentes, necessidadeSubstituicao, pendentesDeSubstituto] = await Promise.all([
        Ferias.findAll({ where: { status: 'Solicitada' }, include: [{ model: Funcionario, where: whereClauseFuncionario, required: true, attributes: ['matricula', 'nome_funcionario'] }] }),
        Ferias.findAll({ where: { necessidade_substituicao: true, status: { [Op.in]: ['Planejada', 'Confirmada'] }, data_inicio: { [Op.gte]: hoje } }, include: [{ model: Funcionario, where: whereClauseFuncionario, required: true, attributes: ['matricula', 'nome_funcionario'] }] }),
        planejamentoSelecionado ? Ferias.findAll({ where: { planejamentoId: planejamentoSelecionado.id, status: { [Op.in]: ['Planejada', 'Confirmada'] }, data_inicio: { [Op.gte]: hoje }, necessidade_substituicao: true, observacao: { [Op.iLike]: '%Pendente de alocação%' } }, include: [{ model: Funcionario, where: whereClauseFuncionario, required: true, attributes: ['matricula', 'nome_funcionario'] }] }) : Promise.resolve([])
    ]);

    // Gráfico de Distribuição
    let distribuicaoMensal = [];
    if (planejamentoSelecionado) {
        const feriasDoAno = await Ferias.findAll({
            where: { planejamentoId: planejamentoSelecionado.id },
            include: [{ model: Funcionario, where: whereClauseFuncionario, attributes: [], required: true }],
            attributes: [
                [fn('to_char', col('data_inicio'), 'MM'), 'mes'],
                [fn('COUNT', col('Ferias.id')), 'total']
            ],
            group: ['mes'], raw: true
        });
        const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        distribuicaoMensal = mesesDoAno.map((nomeMes, index) => {
            const mesNumero = String(index + 1).padStart(2, '0');
            const mesData = feriasDoAno.find(item => item.mes === mesNumero);
            return { mes: nomeMes, total: mesData ? parseInt(mesData.total, 10) : 0 };
        });
    }

    return {
        cardsPrincipais: {
            totalFuncionarios: { count: totalFuncionariosCount, funcionarios: totalFuncionariosLista },
            planejamentoAtivo: planejamentoSelecionado ? `Ano ${planejamentoSelecionado.ano} (${planejamentoSelecionado.status})` : 'Nenhum',
            funcionariosComFeriasPlanejadas: planejadosResult,
            percentualPlanejado: `${percentualPlanejado}%`
        },
        itensDeAcao: [
            { title: 'Férias Vencidas', variant: 'danger', link: '/funcionarios?filtro=vencidas', count: feriasVencidasResult.count, funcionarios: feriasVencidasResult.rows },
            { title: 'Risco Iminente (30 dias)', variant: 'warning', link: '/funcionarios?filtro=risco_iminente', count: riscoIminenteResult.count, funcionarios: riscoIminenteResult.rows },
            { title: 'A Vencer (31-90 dias)', variant: 'info', link: '/funcionarios?filtro=risco_medio', count: riscoMedioPrazoResult.count, funcionarios: riscoMedioPrazoResult.rows },
            { title: 'Necessitam Substituição', variant: 'info', link: `/planejamento?ano=${anoDoPlanejamento}`, count: getUniqueFuncionariosFromFerias(necessidadeSubstituicao).length, funcionarios: getUniqueFuncionariosFromFerias(necessidadeSubstituicao) },
            { title: 'Solicitações Pendentes', variant: 'neutral', link: `/planejamento?ano=${anoDoPlanejamento}`, count: getUniqueFuncionariosFromFerias(solicitacoesPendentes).length, funcionarios: getUniqueFuncionariosFromFerias(solicitacoesPendentes) },
            { title: 'Pendente de Substituto', variant: 'warning', link: `/planejamento?ano=${anoDoPlanejamento}`, count: getUniqueFuncionariosFromFerias(pendentesDeSubstituto).length, funcionarios: getUniqueFuncionariosFromFerias(pendentesDeSubstituto) }
        ].filter(item => item.count > 0),
        distribuicaoMensal
    };
};

module.exports = { getSummaryData };