// src/features/jobs/jobs.controller.js

const jobsService = require('./jobs.service');

/**
 * Controlador para acionar manualmente a verificação de conflitos de afastamento.
 */
const executarVerificacaoConflitos = async (req, res) => {
    try {
        console.log('[API] Execução manual do job de verificação de conflitos solicitada.');
        const resultado = await jobsService.verificarConflitosDeAfastamento();
        res.status(200).send(resultado);
    } catch (error) {
        console.error('Erro no controller ao executar job de verificação de conflitos:', error);
        res.status(500).send({ message: 'Falha ao executar a verificação de conflitos.', error: error.message });
    }
};

module.exports = {
    executarVerificacaoConflitos
};