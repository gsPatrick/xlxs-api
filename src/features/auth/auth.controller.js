// src/features/auth/auth.controller.js
const authService = require('./auth.service');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({ message: 'E-mail e senha são obrigatórios.' });
        }

        const result = await authService.login(email, password);
        res.status(200).send(result);
    } catch (error) {
        // Retorna um erro genérico para não dar dicas a atacantes
        res.status(401).send({ message: error.message });
    }
};

module.exports = { login };