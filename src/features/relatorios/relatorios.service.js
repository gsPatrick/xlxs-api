// src/features/relatorios/relatorios.service.js
const { Op } = require('sequelize');
const { Funcionario, Ferias } = require('../../models');
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
 * @param {object} queryParams - Filtros da query string (busca, status, municipio, filtro especial).
 * @param {Array<string>} [matriculas=[]] - Lista opcional de matrículas para exportar.
 * @returns {Promise<{buffer: Buffer, fileName: string}>} O buffer do arquivo XLSX e o nome do arquivo.
 */
const gerarXLSXFuncionarios = async (queryParams, matriculas = []) => {
    const whereClause = {};

    // Prioridade 1: Se uma lista de matrículas foi fornecida, usa apenas ela.
    if (matriculas && matriculas.length > 0) {
        whereClause.matricula = { [Op.in]: matriculas };
    } else {
        // Prioridade 2: Aplica os filtros da query string (idênticos à listagem).
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
            if (queryParams.filtro === 'vencidas') {
                whereClause.dth_limite_ferias = { [Op.lt]: hoje };
            }
            if (queryParams.filtro === 'risco_iminente') {
                const dataLimiteRisco = addDays(hoje, 30);
                whereClause.dth_limite_ferias = { [Op.between]: [hoje, dataLimiteRisco] };
            }
        }
    }

    const funcionarios = await Funcionario.findAll({
        where: whereClause,
        order: [['nome_funcionario', 'ASC']],
        raw: true
    });

    if (funcionarios.length === 0) {
        throw new Error("Nenhum funcionário encontrado para os critérios de exportação selecionados.");
    }

    const ws = XLSX.utils.json_to_sheet(funcionarios);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    return { buffer, fileName: `Relatorio_Funcionarios.xlsx` };
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
    gerarXLSXFuncionarios
};