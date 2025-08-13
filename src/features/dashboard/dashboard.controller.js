// src/features/dashboard/dashboard.controller.js
const dashboardService = require('./dashboard.service');

const getSummary = async (req, res) => {
    try {
        const summaryData = await dashboardService.getSummaryData();
        res.status(200).send(summaryData);
    } catch (error) {
        console.error('Erro no controller ao buscar resumo do dashboard:', error);
        res.status(500).send({ message: 'Falha ao buscar dados do resumo.', error: error.message });
    }
};

module.exports = { getSummary };    