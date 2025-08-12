// src/features/relatorios/relatorios.controller.js
const relatoriosService = require('./relatorios.service');

const gerarRelatorioRiscoVencimento = async (req, res) => {
    try {
        const { buffer, fileName } = await relatoriosService.gerarXLSXRiscoVencimento(req.query);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error("Erro no controller ao gerar relatório de risco:", error);
        res.status(500).send({ message: 'Falha ao gerar relatório.', error: error.message });
    }
};

const gerarRelatorioProjecaoCustos = async (req, res) => {
    try {
        const { buffer, fileName } = await relatoriosService.gerarXLSXProjecaoCustos(req.query);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error("Erro no controller ao gerar projeção de custos:", error);
        res.status(500).send({ message: 'Falha ao gerar relatório.', error: error.message });
    }
};

const gerarAvisoFerias = async (req, res) => {
    try {
        const { feriasId } = req.params;
        const { buffer, fileName } = await relatoriosService.gerarAvisoFeriasXLSX(feriasId);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error("Erro no controller ao gerar aviso de férias:", error);
        res.status(500).send({ message: 'Falha ao gerar documento.', error: error.message });
    }
};

module.exports = {
    gerarRelatorioRiscoVencimento,
    gerarRelatorioProjecaoCustos,
    gerarAvisoFerias,
};