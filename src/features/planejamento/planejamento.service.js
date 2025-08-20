// src/features/planejamento/planejamento.service.js

const { Planejamento, Ferias, Afastamento, Funcionario } = require('../../models');
const db = require('../../models');
const { startOfMonth, endOfMonth, parseISO } = require('date-fns');
const { Op } = require('sequelize');

/**
 * Busca o histórico de planejamentos.
 */
const findAll = async (queryParams) => {
    // ... (código existente inalterado)
    const whereClause = {};
    if(queryParams.ano) {
        whereClause.ano = queryParams.ano;
    }
    return Planejamento.findAll({
        where: whereClause,
        order: [['ano', 'DESC'], ['criado_em', 'DESC']]
    });
};

/**
 * Ativa (restaura) um planejamento arquivado.
 */
const ativar = async (id) => {
    // ... (código existente inalterado)
    const t = await db.sequelize.transaction();
    try {
        const planejamentoParaAtivar = await Planejamento.findByPk(id, { transaction: t });
        if (!planejamentoParaAtivar) {
            throw new Error('Planejamento não encontrado.');
        }

        await Planejamento.update(
            { status: 'arquivado' },
            { where: { ano: planejamentoParaAtivar.ano, status: 'ativo' }, transaction: t }
        );

        planejamentoParaAtivar.status = 'ativo';
        await planejamentoParaAtivar.save({ transaction: t });

        await t.commit();
        return planejamentoParaAtivar;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};


// ======================================================================
// ALTERADO: Função `getVisaoGeral` expandida com novos filtros
// ======================================================================
/**
 * Busca uma visão geral de todas as ausências (férias e afastamentos)
 * para um determinado mês e ano, com filtros.
 * @param {object} queryParams - Parâmetros da query, como { mes: 5, ano: 2024, grupoContrato: 'GERAL' }.
 * @returns {Promise<Array<object>>} Uma lista de eventos de ausência.
 */
const getVisaoGeral = async (queryParams) => {
    const ano = parseInt(queryParams.ano, 10);
    const mes = parseInt(queryParams.mes, 10);

    if (!ano || !mes) {
        throw new Error("Ano e mês são obrigatórios.");
    }

    const dataReferencia = new Date(ano, mes - 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    // NOVO: Construção da cláusula de filtro para o modelo Funcionario
    const whereFuncionario = {};
    if (queryParams.grupoContrato) {
        whereFuncionario.des_grupo_contrato = queryParams.grupoContrato;
    }
    if (queryParams.municipio) {
        whereFuncionario.municipio_local_trabalho = queryParams.municipio;
    }
    if (queryParams.categoria) {
        whereFuncionario.categoria = queryParams.categoria;
    }
    if (queryParams.tipoContrato) {
        whereFuncionario.categoria_trab = queryParams.tipoContrato;
    }

    // Busca Férias que ocorrem no mês, aplicando o filtro de funcionário
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
        include: [{ 
            model: Funcionario, 
            attributes: ['nome_funcionario'],
            where: whereFuncionario, // Filtro aplicado aqui
            required: true // Transforma em INNER JOIN
        }]
    });

    // Busca Afastamentos que ocorrem no mês, aplicando o filtro de funcionário
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
        include: [{ 
            model: Funcionario, 
            attributes: ['nome_funcionario'],
            where: whereFuncionario, // Filtro aplicado aqui
            required: true // Transforma em INNER JOIN
        }]
    });

    // Formata e combina os resultados
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
            status: a.motivo,
            funcionario: a.Funcionario.nome_funcionario,
            matricula: a.matricula_funcionario
        });
    });

    eventos.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    return eventos;
};


module.exports = {
    findAll,
    ativar,
    getVisaoGeral
};