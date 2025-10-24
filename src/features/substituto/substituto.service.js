    // src/features/substituto/substituto.service.js

const { Substituto, Funcionario } = require('../../models');

/**
 * Adiciona um novo funcionário ao quadro de substitutos.
 * @param {object} substitutoData - Dados do substituto, incluindo matricula_funcionario e cargos_aptos.
 * @returns {Promise<object>} O objeto do substituto criado, incluindo os dados do funcionário.
 */
const create = async (substitutoData) => {
    const { matricula_funcionario, cargos_aptos } = substitutoData;

    if (!matricula_funcionario) {
        throw new Error("A matrícula do funcionário é obrigatória.");
    }

    // 1. Verifica se o funcionário existe
    const funcionario = await Funcionario.findByPk(matricula_funcionario);
    if (!funcionario) {
        throw new Error("Funcionário não encontrado com a matrícula fornecida.");
    }

    // 2. Verifica se o funcionário já não está no quadro de substitutos
    const substitutoExistente = await Substituto.findOne({ where: { matricula_funcionario } });
    if (substitutoExistente) {
        throw new Error("Este funcionário já está cadastrado como substituto.");
    }

    // 3. Cria o registro
    const novoSubstituto = await Substituto.create({
        matricula_funcionario,
        cargos_aptos,
        status: 'Disponível',
    });

    // Retorna o novo registro com os dados do funcionário associado
    return Substituto.findByPk(novoSubstituto.id, {
        include: [{
            model: Funcionario,
            attributes: ['matricula', 'nome_funcionario', 'categoria']
        }]
    });
};

/**
 * Lista todos os funcionários do quadro de substitutos.
 * @returns {Promise<Array<object>>} Uma lista de substitutos com os dados dos funcionários.
 */
const findAll = async () => {
    return Substituto.findAll({
        include: [{
            model: Funcionario,
            attributes: ['matricula', 'nome_funcionario', 'categoria', 'status'],
            required: true // Garante que só traga substitutos com funcionários válidos
        }],
        order: [[Funcionario, 'nome_funcionario', 'ASC']]
    });
};

/**
 * Remove um funcionário do quadro de substitutos.
 * @param {number} id - O ID do registro do substituto.
 * @returns {Promise<object>} Uma mensagem de sucesso.
 */
const remove = async (id) => {
    const substituto = await Substituto.findByPk(id);
    if (!substituto) {
        throw new Error("Registro de substituto não encontrado.");
    }

    await substituto.destroy();

    return { message: 'Funcionário removido do quadro de substitutos com sucesso.' };
};


/**
 * Atualiza os dados de um substituto.
 * @param {number} id - O ID do registro de substituto.
 * @param {object} updateData - Os dados a serem atualizados (ex: cargos_aptos, status).
 * @returns {Promise<object>} O registro de substituto atualizado.
 */
const update = async (id, updateData) => {
    const substituto = await Substituto.findByPk(id, { include: [Funcionario] });
    if (!substituto) {
        throw new Error("Registro de substituto não encontrado.");
    }

    await substituto.update(updateData);
    return substituto;
};


module.exports = {
    create,
    findAll,
    remove,
    update
};