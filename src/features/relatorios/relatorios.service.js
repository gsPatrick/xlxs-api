// src/features/relatorios/relatorios.service.js
const { Op } = require('sequelize');
const { Funcionario, Ferias, Planejamento } = require('../../models');
const { addDays } = require('date-fns');
const XLSX = require('xlsx');

// Lógica para gerar o relatório de risco de vencimento
const gerarXLSXRiscoVencimento = async (queryParams) => {
    const dias = parseInt(queryParams.dias || 90, 10);
    const hoje = new Date();
    const dataLimite = addDays(hoje, dias);

    const funcionariosEmRisco = await Funcionario.findAll({
        where: {
            dth_limite_ferias: { [Op.between]: [hoje, dataLimite] }
        },
        attributes: ['matricula', 'nome_funcionario', 'dth_limite_ferias'],
        order: [['dth_limite_ferias', 'ASC']],
        raw: true
    });

    const ws = XLSX.utils.json_to_sheet(funcionariosEmRisco);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Risco de Vencimento");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    return { buffer, fileName: `Relatorio_Risco_Vencimento_${dias}_dias.xlsx` };
};

/**
 * Gera um arquivo XLSX de funcionários com base em filtros dinâmicos e/ou uma lista de matrículas.
 */
const gerarXLSXFuncionarios = async (queryParams, matriculas = []) => {
    const whereClause = {};

    if (matriculas && matriculas.length > 0) {
        whereClause.matricula = { [Op.in]: matriculas };
    } else {
        if (queryParams.busca) {
            whereClause[Op.or] = [
                { nome_funcionario: { [Op.iLike]: `%${queryParams.busca}%` } },
                { matricula: { [Op.iLike]: `%${queryParams.busca}%` } }
            ];
        }
        if (queryParams.status) { whereClause.status = queryParams.status; }
        if (queryParams.municipio) { whereClause.municipio_local_trabalho = queryParams.municipio; }
        if (queryParams.filtro) {
            const hoje = new Date();
            if (queryParams.filtro === 'vencidas') whereClause.dth_limite_ferias = { [Op.lt]: hoje };
            if (queryParams.filtro === 'risco_iminente') {
                const dataLimiteRisco = addDays(hoje, 30);
                whereClause.dth_limite_ferias = { [Op.between]: [hoje, dataLimiteRisco] };
            }
        }
    }

    const funcionarios = await Funcionario.findAll({ where: whereClause, order: [['nome_funcionario', 'ASC']], raw: true });
    if (funcionarios.length === 0) throw new Error("Nenhum funcionário encontrado para os critérios selecionados.");

    const ws = XLSX.utils.json_to_sheet(funcionarios);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    return { buffer, fileName: `Relatorio_Funcionarios.xlsx` };
};

// ==========================================================
// NOVA FUNÇÃO
// ==========================================================
/**
 * Gera um arquivo XLSX do planejamento de férias ativo com base em filtros.
 * @param {object} queryParams - Filtros da query string (ano, busca, status, etc.).
 * @returns {Promise<{buffer: Buffer, fileName: string}>} O buffer do arquivo XLSX e o nome do arquivo.
 */
const gerarXLSXPlanejamento = async (queryParams) => {
    const ano = parseInt(queryParams.ano, 10) || new Date().getFullYear();

    const planejamentoAtivo = await Planejamento.findOne({ where: { ano, status: 'ativo' } });
    if (!planejamentoAtivo) {
        throw new Error(`Nenhum planejamento ativo encontrado para o ano de ${ano}.`);
    }

    const whereFuncionario = {};
    const whereFerias = { planejamentoId: planejamentoAtivo.id };

    if (queryParams.q) { whereFuncionario[Op.or] = [{ nome_funcionario: { [Op.iLike]: `%${queryParams.q}%` } }, { matricula: { [Op.iLike]: `%${queryParams.q}%` } }]; }
    if (queryParams.categoria) { whereFuncionario.categoria = { [Op.iLike]: `%${queryParams.categoria}%` }; }
    if (queryParams.des_grupo_contrato) { whereFuncionario.des_grupo_contrato = { [Op.iLike]: `%${queryParams.des_grupo_contrato}%` }; }
    if (queryParams.municipio_local_trabalho) { whereFuncionario.municipio_local_trabalho = { [Op.iLike]: `%${queryParams.municipio_local_trabalho}%` }; }
    if (queryParams.escala) { whereFuncionario.escala = { [Op.iLike]: `%${queryParams.escala}%` }; }
    if (queryParams.sigla_local) { whereFuncionario.sigla_local = { [Op.iLike]: `%${queryParams.sigla_local}%` }; }
    if (queryParams.cliente) { whereFuncionario.cliente = { [Op.iLike]: `%${queryParams.cliente}%` }; }
    if (queryParams.contrato) { whereFuncionario.contrato = { [Op.iLike]: `%${queryParams.contrato}%` }; }

    const feriasPlanejadas = await Ferias.findAll({
        where: whereFerias,
        include: [{
            model: Funcionario,
            where: whereFuncionario,
            required: true
        }],
        order: [['data_inicio', 'ASC']],
    });

    if (feriasPlanejadas.length === 0) {
        throw new Error("Nenhum registro de férias encontrado para os filtros selecionados.");
    }

    // Formata os dados para um layout de planilha mais amigável
    const dadosFormatados = feriasPlanejadas.map(f => ({
        "Matrícula": f.Funcionario.matricula,
        "Nome do Funcionário": f.Funcionario.nome_funcionario,
        "Status das Férias": f.status,
        "Início das Férias": f.data_inicio,
        "Fim das Férias": f.data_fim,
        "Dias": f.qtd_dias,
        "Necessita Substituição?": f.necessidade_substituicao ? 'Sim' : 'Não',
        "Categoria/Cargo": f.Funcionario.categoria,
        "Gestão do Contrato": f.Funcionario.des_grupo_contrato,
        "Município": f.Funcionario.municipio_local_trabalho,
        "Estado (UF)": f.Funcionario.sigla_local,
        "Status do Funcionário": f.Funcionario.status,
        "Observação": f.observacao,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Planejamento ${ano}`);
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return { buffer, fileName: `Relatorio_Planejamento_Ferias_${ano}.xlsx` };
};


// Lógica para gerar o relatório de projeção de custos (mockado por enquanto)
const gerarXLSXProjecaoCustos = async (queryParams) => {
    const mockCustos = [
        { mes: 'Janeiro', custo_estimado: 15200.50 },
        { mes: 'Fevereiro', custo_estimado: 18150.00 },
        { mes: 'Março', custo_estimado: 25400.00 },
    ];

    const ws = XLSX.utils.json_to_sheet(mockCustos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projeção de Custos");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return { buffer, fileName: `Relatorio_Projecao_Custos_${queryParams.ano || 'geral'}.xlsx` };
};

// Lógica para gerar o Aviso de Férias individual
const gerarAvisoFeriasXLSX = async (feriasId) => {
    const ferias = await Ferias.findByPk(feriasId, { include: [Funcionario] });
    if (!ferias) {
        throw new Error('Registro de férias não encontrado.');
    }

    const data = [
        ["AVISO DE FÉRIAS"], [],
        ["Prezado(a) Colaborador(a):", ferias.Funcionario.nome_funcionario],
        ["Matrícula:", ferias.Funcionario.matricula], [],
        ["Comunicamos que suas férias relativas ao período aquisitivo de:", `${new Date(ferias.periodo_aquisitivo_inicio).toLocaleDateString()} a ${new Date(ferias.periodo_aquisitivo_fim).toLocaleDateString()}`],
        ["Serão concedidas conforme abaixo:"], [],
        ["Início do Gozo:", ferias.data_inicio],
        ["Fim do Gozo:", ferias.data_fim],
        ["Total de Dias:", ferias.qtd_dias],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aviso de Férias");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return { buffer, fileName: `Aviso_Ferias_${ferias.Funcionario.nome_funcionario.replace(/\s/g, '_')}.xlsx` };
};

module.exports = {
    gerarXLSXRiscoVencimento,
    gerarXLSXProjecaoCustos,
    gerarAvisoFeriasXLSX,
    gerarXLSXFuncionarios,
    gerarXLSXPlanejamento // Exporta a nova função
};