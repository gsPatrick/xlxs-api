// src/features/ferias/ferias.controller.js

const feriasService = require('./ferias.service');

// Esta função era chamada 'listar' e tentava usar 'listarFerias'
const findAll = async (req, res) => {
    try {
        // CORREÇÃO: Chamando a função com o nome correto 'findAll'
        const ferias = await feriasService.findAll(req.query);
        res.status(200).send(ferias);
    } catch (error) {
        console.error("Erro no controller ao listar férias:", error); // Adicionado log de erro
        res.status(500).send({ message: 'Falha ao buscar férias.', error: error.message });
    }
};

const distribuir = async (req, res) => {
    try {
        const { ano, descricao } = req.body;
        // Validação básica dos dados de entrada
        if (!ano || isNaN(parseInt(ano))) {
            return res.status(400).send({ message: 'O ano é obrigatório e deve ser um número.' });
        }
        const resultado = await feriasService.distribuirFerias(parseInt(ano), descricao);
        res.status(200).send(resultado);
    } catch (error) {
        console.error("Erro no controller ao distribuir férias:", error); // Adicionado log de erro
        res.status(500).send({ message: 'Falha ao distribuir férias.', error: error.message });
    }
};

// Adicionando as funções de CRUD que podem estar faltando no seu controlador
const create = async (req, res) => {
    try {
        const novaFeria = await feriasService.create(req.body);
        res.status(201).send(novaFeria);
    } catch (error) {
        console.error("Erro no controller ao criar férias:", error);
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