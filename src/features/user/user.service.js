// src/features/user/user.service.js
const { User } = require('../../models');
const { Op } = require('sequelize');

const findAll = async () => {
    // Retorna todos os usuários, mas omite o campo de senha
    return User.findAll({
        attributes: { exclude: ['password'] },
        order: [['nome', 'ASC']]
    });
};

const create = async (userData) => {
    const { nome, email, password } = userData;
    if (!nome || !email || !password) {
        throw new Error("Nome, e-mail e senha são obrigatórios.");
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw new Error("E-mail já cadastrado.");
    }

    const newUser = await User.create({ nome, email, password, role: 'admin' });
    // Remove a senha do objeto retornado
    const { password: _, ...userWithoutPassword } = newUser.toJSON();
    return userWithoutPassword;
};

const update = async (id, userData) => {
    const user = await User.findByPk(id);
    if (!user) {
        throw new Error("Usuário não encontrado.");
    }
    // Não permite atualizar o e-mail se já existir em outro usuário
    if (userData.email && userData.email !== user.email) {
        const existing = await User.findOne({ where: { email: userData.email, id: { [Op.ne]: id } }});
        if (existing) throw new Error("E-mail já está em uso por outro usuário.");
    }
    // Se a senha for uma string vazia, não a atualizamos
    if (userData.password === '') {
        delete userData.password;
    }
    await user.update(userData);
    const { password, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
};

const remove = async (id) => {
    const user = await User.findByPk(id);
    if (!user) {
        throw new Error("Usuário não encontrado.");
    }
    // Adicionar regra para não permitir a exclusão do último admin, se necessário
    await user.destroy();
    return { message: 'Usuário excluído com sucesso.' };
};

module.exports = { findAll, create, update, remove };