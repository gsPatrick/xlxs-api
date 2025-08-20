// src/features/alertas/alertas.controller.js

const alertasService = require('./alertas.service');

const getRetornosProximos = async (req, res) => {
    try {
        const funcionarios = await alertasService.findRetornosProximos(req.query);
        res.status(200).send(funcionarios);
    } catch (error) {
        console.error("Erro no controller ao buscar retornos de afastamento:", error);
        res.status(400).send({ message: 'Falha ao buscar alertas de retorno.', error: error.message });
    }
};

// ==========================================================
// NOVO CONTROLLER (SEÇÃO 4.C DO PDF)
// ==========================================================
const getNecessitaReprogramacao = async (req, res) => {
    try {
        const funcionarios = await alertasService.findNecessitaReprogramacao(req.query);
        res.status(200).send(funcionarios);
    } catch (error) {
        console.error("Erro no controller ao buscar necessidade de reprogramação:", error);
        res.status(500).send({ message: 'Falha ao buscar alertas de reprogramação.', error: error.message });
    }
};

module.exports = {
    getRetornosProximos,
    getNecessitaReprogramacao // Exporta o novo controller
};