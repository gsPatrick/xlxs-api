// src/features/user/user.controller.js
const userService = require('./user.service');

const findAll = async (req, res) => {
    try {
        const users = await userService.findAll();
        res.status(200).send(users);
    } catch (error) {
        res.status(500).send({ message: 'Erro ao buscar usuários.', error: error.message });
    }
};

const create = async (req, res) => {
    try {
        const newUser = await userService.create(req.body);
        res.status(201).send(newUser);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

const update = async (req, res) => {
    try {
        const updatedUser = await userService.update(req.params.id, req.body);
        res.status(200).send(updatedUser);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
};

const remove = async (req, res) => {
    try {
        await userService.remove(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(404).send({ message: error.message });
    }
};

module.exports = { findAll, create, update, remove };