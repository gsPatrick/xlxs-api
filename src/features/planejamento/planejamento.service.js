// src/features/planejamento/planejamento.controller.js
const planejamentoService = require('./planejamento.service');

const findAll = async (req, res) => {
    try {
        const planejamentos = await planejamentoService.findAll(req.query);
        res.status(200).send(planejamentos);
    } catch (error) {
        console.error("Erro no controller ao buscar planejamentos:", error);
        res.status(500).send({ message: 'Falha ao buscar planejamentos.', error: error.message });
    }
};

const ativar = async (req, res) => {
    try {
        const { id } = req.params;
        const planejamentoAtivado = await planejamentoService.ativar(id);
        res.status(200).send({ message: 'Planejamento restaurado com sucesso.', planejamento: planejamentoAtivado });
    } catch (error) {
        console.error("Erro no controller ao ativar planejamento:", error);
        res.status(500).send({ message: 'Falha ao restaurar planejamento.', error: error.message });
    }
};

module.exports = { findAll, ativar };