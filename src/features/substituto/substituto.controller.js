// src/features/substituto/substituto.controller.js

const substitutoService = require('./substituto.service');

/**
 * Controlador para criar um novo substituto.
 */
const create = async (req, res) => {
    try {
        const novoSubstituto = await substitutoService.create(req.body);
        res.status(201).send(novoSubstituto);
    } catch (error) {
        // Usa 409 (Conflict) se o recurso já existe, ou 400 para outras validações
        if (error.message.includes("já está cadastrado")) {
            return res.status(409).send({ message: error.message });
        }
        res.status(400).send({ message: error.message });
    }
};

/**
 * Controlador para listar todos os substitutos.
 */
const findAll = async (req, res) => {
    try {
        const substitutos = await substitutoService.findAll();
        res.status(200).send(substitutos);
    } catch (error) {
        res.status(500).send({ message: 'Erro ao buscar quadro de substitutos.', error: error.message });
    }
};

/**
 * Controlador para remover um substituto.
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        await substitutoService.remove(id);
        res.status(204).send(); // 204 No Content para sucesso na exclusão
    } catch (error) {
        // Usa 404 se o recurso a ser deletado não for encontrado
        if (error.message.includes("não encontrado")) {
            return res.status(404).send({ message: error.message });
        }
        res.status(500).send({ message: 'Falha ao remover substituto.', error: error.message });
    }
};

/**
 * Controlador para atualizar um substituto.
 */
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const substitutoAtualizado = await substitutoService.update(id, req.body);
        res.status(200).send(substitutoAtualizado);
    } catch (error) {
        if (error.message.includes("não encontrado")) {
            return res.status(404).send({ message: error.message });
        }
        res.status(400).send({ message: 'Falha ao atualizar substituto.', error: error.message });
    }
};


module.exports = {
    create,
    findAll,
    remove,
    update
};