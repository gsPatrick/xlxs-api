// src/features/ferias/ferias.controller.js

const feriasService = require('./ferias.service');

// NOVO: Controlador para a listagem paginada do planejamento
const findAllPaginated = async (req, res) => {
    try {
        const ferias = await feriasService.findAllPaginated(req.query);
        res.status(200).send(ferias);
    } catch (error) {
        console.error("Erro no controller ao listar planejamento de férias:", error);
        res.status(500).send({ message: 'Falha ao buscar planejamento de férias.', error: error.message });
    }
};

const distribuir = async (req, res) => {
    try {
        const { ano, descricao } = req.body;
        if (!ano || isNaN(parseInt(ano))) return res.status(400).send({ message: 'O ano é obrigatório.' });
        const resultado = await feriasService.distribuirFerias(parseInt(ano), descricao);
        res.status(200).send(resultado);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao distribuir férias.', error: error.message });
    }
};

const create = async (req, res) => {
    try {
        const matricula = req.params.matricula || req.body.matricula_funcionario;
        const dadosFerias = { ...req.body, matricula_funcionario: matricula };
        const novaFeria = await feriasService.create(dadosFerias);
        res.status(201).send(novaFeria);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao criar registro de férias.', error: error.message });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const feriaAtualizada = await feriasService.update(id, req.body);
        res.status(200).send(feriaAtualizada);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao atualizar registro de férias.', error: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        await feriasService.remove(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).send({ message: 'Falha ao remover registro de férias.', error: error.message });
    }
};

const bulkRemove = async (req, res) => {
    try {
        const { ids } = req.body;
        const result = await feriasService.bulkRemove(ids);
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao remover férias em massa.', error: error.message });
    }
};

module.exports = { 
    findAllPaginated,
    distribuir,
    create,
    update,
    remove,
    bulkRemove
};