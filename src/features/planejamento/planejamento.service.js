// src/features/planejamento/planejamento.service.js

const { Planejamento } = require('../../models');
const db = require('../../models'); // Usado para transações do Sequelize

/**
 * Busca o histórico de planejamentos, com filtro opcional por ano.
 * @param {object} queryParams - Parâmetros da query, como { ano: 2024 }.
 * @returns {Promise<Array<object>>} A lista de planejamentos.
 */
const findAll = async (queryParams) => {
    const whereClause = {};
    if (queryParams.ano) {
        whereClause.ano = parseInt(queryParams.ano, 10);
    }
    return Planejamento.findAll({
        where: whereClause,
        order: [['criado_em', 'DESC']]
    });
};

/**
 * Ativa (restaura) um planejamento arquivado.
 * @param {number} id - O ID do planejamento a ser restaurado.
 * @returns {Promise<object>} O objeto do planejamento ativado.
 */
const ativar = async (id) => {
    const planejamentoParaAtivar = await Planejamento.findByPk(id);
    if (!planejamentoParaAtivar) {
        throw new Error("Planejamento não encontrado.");
    }
    if (planejamentoParaAtivar.status === 'ativo') {
        return planejamentoParaAtivar; // Já está ativo, não faz nada.
    }

    // Usa uma transação para garantir a integridade da operação
    const t = await db.sequelize.transaction();
    try {
        // 1. Arquiva qualquer outro planejamento que esteja ativo para o mesmo ano.
        await Planejamento.update(
            { status: 'arquivado' },
            { where: { ano: planejamentoParaAtivar.ano, status: 'ativo' }, transaction: t }
        );

        // 2. Ativa o planejamento escolhido.
        planejamentoParaAtivar.status = 'ativo';
        await planejamentoParaAtivar.save({ transaction: t });

        // Confirma a transação
        await t.commit();
        return planejamentoParaAtivar;
    } catch (error) {
        // Desfaz tudo em caso de erro
        await t.rollback();
        throw error;
    }
};

module.exports = {
    findAll,
    ativar
};