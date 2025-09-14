// src/features/auth/auth.service.js
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');

// Garanta que você tenha a variável JWT_SECRET no seu arquivo .env
// Exemplo: JWT_SECRET=sua_chave_secreta_super_longa_e_aleatoria
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Autentica um usuário e retorna um token JWT junto com os dados do usuário.
 * @param {string} email - O e-mail do usuário.
 * @param {string} password - A senha do usuário.
 * @returns {Promise<object>} Um objeto contendo os dados do usuário e o token.
 * @throws {Error} Se as credenciais forem inválidas.
 */
const login = async (email, password) => {
    // 1. Encontrar o usuário pelo e-mail no banco de dados.
    const user = await User.findOne({ where: { email } });
    if (!user) {
        // Lança um erro genérico para não informar se o e-mail existe ou não.
        throw new Error('Credenciais inválidas.');
    }

    // 2. Verificar se a senha fornecida corresponde à senha hash armazenada.
    const isPasswordValid = await user.isValidPassword(password);
    if (!isPasswordValid) {
        throw new Error('Credenciais inválidas.');
    }

    // 3. Criar o payload (dados que serão embutidos no token).
    // É uma boa prática incluir apenas informações não sensíveis e necessárias para a autorização.
    const payload = {
        id: user.id,
        nome: user.nome, // Incluindo o nome no payload do token
        email: user.email,
        role: user.role
    };

    // 4. Gerar o token JWT.
    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '8h' // O token será válido por 8 horas.
    });

    // 5. Retornar a resposta para o front-end.
    // A MUDANÇA PRINCIPAL ESTÁ AQUI.
    return {
        user: {
            // Adicionamos o campo 'nome' para ser salvo no localStorage do front-end.
            nome: user.nome, 
            email: user.email,
            role: user.role
        },
        token
    };
};

module.exports = { login };