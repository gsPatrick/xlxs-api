// src/features/ferias/ferias.controller.js

const feriasService = require('./ferias.service');

const findAll = async (req, res) => {
    try {
        const ferias = await feriasService.findAll(req.query);
        res.status(200).send(ferias);
    } catch (error) {
        console.error("Erro no controller ao listar férias:", error);
        res.status(500).send({ message: 'Falha ao buscar férias.', error: error.message });
    }
};

const distribuir = async (req, res) => {
    try {
        const { ano, descricao } = req.body;
        if (!ano || isNaN(parseInt(ano))) {
            return res.status(400).send({ message: 'O ano é obrigatório e deve ser um número.' });
        }
        // O resultado agora contém { message, registrosCriados, funcionariosExcluidos }
        const resultado = await feriasService.distribuirFerias(parseInt(ano), descricao);
        res.status(200).send(resultado);
    } catch (error) {
        console.error("Erro no controller ao distribuir férias:", error);
        res.status(500).send({ message: 'Falha ao distribuir férias.', error: error.message });
    }
};

const create = async (req, res) => {
    try {
        // =====================================================================
        // CORREÇÃO: Pega a matrícula dos parâmetros da URL OU do corpo da requisição.
        // Isso torna o controlador compatível com ambas as rotas:
        // POST /api/ferias (com matricula_funcionario no body)
        // POST /api/funcionarios/:matricula/ferias (com matricula nos params)
        // =====================================================================
        const matricula = req.params.matricula || req.body.matricula_funcionario;
        if (!matricula) {
            return res.status(400).send({ message: 'Matrícula do funcionário é obrigatória.' });
        }
        
        const dadosFerias = { ...req.body, matricula_funcionario: matricula };

        const novaFeria = await feriasService.create(dadosFerias);
        res.status(201).send(novaFeria);
    } catch (error) {
        console.error("Erro no controller ao criar férias:", error);
        // O erro de validação que você viu (notNull Violation) será capturado aqui
        res.status(500).send({ message: 'Falha ao criar registro de férias.', error: error.message });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const feriaAtualizada = await feriasService.update(id, req.body);
        res.status(200).send(feriaAtualizada);
    } catch (error) {
        console.error("Erro no controller ao atualizar férias:", error);
        res.status(500).send({ message: 'Falha ao atualizar registro de férias.', error: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        await feriasService.remove(id);
        res.status(204).send();
    } catch (error) {
        console.error("Erro no controller ao remover férias:", error);
        res.status(500).send({ message: 'Falha ao remover registro de férias.', error: error.message });
    }
};

module.exports = { 
    findAll, 
    distribuir,
    create,
    update,
    remove
};