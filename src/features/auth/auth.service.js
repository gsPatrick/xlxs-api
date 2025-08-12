// src/features/auth/auth.service.js
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');

// Adicione uma chave secreta no seu arquivo .env
// JWT_SECRET=sua_chave_secreta_super_longa_e_aleatoria
const JWT_SECRET = process.env.JWT_SECRET;

const login = async (email, password) => {
    // 1. Encontrar o usuário pelo e-mail
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new Error('Credenciais inválidas.');
    }

    // 2. Verificar se a senha está correta
    const isPasswordValid = await user.isValidPassword(password);
    if (!isPasswordValid) {
        throw new Error('Credenciais inválidas.');
    }

    // 3. Gerar o token JWT
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '8h' // Token expira em 8 horas
    });

    return {
        user: {
            email: user.email,
            role: user.role
        },
        token
    };
};

module.exports = { login };