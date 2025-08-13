// src/features/planejamento/planejamento.service.js

const { Planejamento, Ferias, Afastamento, Funcionario } = require('../../models'); // Adicionar Afastamento e Funcionario
const db = require('../../models');
const { startOfMonth, endOfMonth, parseISO } = require('date-fns'); // Funções de data
const { Op } = require('sequelize');

/**
 * Busca o histórico de planejamentos.
 */
const findAll = async (queryParams) => {
    // ... (código existente inalterado)
};

/**
 * Ativa (restaura) um planejamento arquivado.
 */
const ativar = async (id) => {
    // ... (código existente inalterado)
};

// ======================================================================
// NOVA FUNÇÃO PARA A PÁGINA DE PLANEJAMENTO
// ======================================================================
/**
 * Busca uma visão geral de todas as ausências (férias e afastamentos)
 * para um determinado mês e ano.
 * @param {object} queryParams - Parâmetros da query, como { mes: 5, ano: 2024 }.
 * @returns {Promise<Array<object>>} Uma lista de eventos de ausência.
 */
const getVisaoGeral = async (queryParams) => {
    const ano = parseInt(queryParams.ano, 10);
    const mes = parseInt(queryParams.mes, 10);

    if (!ano || !mes) {
        throw new Error("Ano e mês são obrigatórios.");
    }

    // Define o intervalo de datas para o mês solicitado
    const dataReferencia = new Date(ano, mes - 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    // Busca Férias que ocorrem no mês
    const feriasNoMes = await Ferias.findAll({
        where: {
            [Op.or]: [
                { data_inicio: { [Op.between]: [inicioMes, fimMes] } },
                { data_fim: { [Op.between]: [inicioMes, fimMes] } },
                { [Op.and]: [
                    { data_inicio: { [Op.lte]: inicioMes } },
                    { data_fim: { [Op.gte]: fimMes } }
                ]}
            ]
        },
        include: [{ model: Funcionario, attributes: ['nome_funcionario'] }]
    });

    // Busca Afastamentos que ocorrem no mês
    const afastamentosNoMes = await Afastamento.findAll({
        where: {
            [Op.or]: [
                { data_inicio: { [Op.between]: [inicioMes, fimMes] } },
                { data_fim: { [Op.between]: [inicioMes, fimMes] } },
                { [Op.and]: [
                    { data_inicio: { [Op.lte]: inicioMes } },
                    { data_fim: { [Op.gte]: fimMes } }
                ]}
            ]
        },
        include: [{ model: Funcionario, attributes: ['nome_funcionario'] }]
    });

    // Formata e combina os resultados em uma única lista de "eventos"
    const eventos = [];
    feriasNoMes.forEach(f => {
        eventos.push({
            id: `ferias-${f.id}`,
            tipo: 'Férias',
            data_inicio: f.data_inicio,
            data_fim: f.data_fim,
            status: f.status,
            funcionario: f.Funcionario.nome_funcionario,
            matricula: f.matricula_funcionario
        });
    });

    afastamentosNoMes.forEach(a => {
        eventos.push({
            id: `afastamento-${a.id}`,
            tipo: 'Afastamento',
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            status: a.motivo, // Usamos o motivo como status para afastamentos
            funcionario: a.Funcionario.nome_funcionario,
            matricula: a.matricula_funcionario
        });
    });

    // Ordena os eventos pela data de início
    eventos.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    return eventos;
};


module.exports = {
    findAll,
    ativar,
    getVisaoGeral // Exporta a nova função
};