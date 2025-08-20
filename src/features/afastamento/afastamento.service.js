// src/features/afastamento/afastamento.service.js

const { Afastamento, Funcionario } = require('../../models');
const { Op } = require('sequelize');
const feriasService = require('../ferias/ferias.service');

// ==========================================================
// NOVA FUNÇÃO (SEÇÃO 2.A DO PDF)
// ==========================================================
/**
 * Busca todos os afastamentos ativos com filtros e paginação.
 * @param {object} queryParams - Parâmetros da query para filtragem e paginação.
 * @returns {Promise<object>} Lista paginada de afastamentos.
 */
const findAllActive = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const whereFuncionario = {};
    if (queryParams.busca) {
        whereFuncionario[Op.or] = [
            { nome_funcionario: { [Op.iLike]: `%${queryParams.busca}%` } },
            { matricula: { [Op.iLike]: `%${queryParams.busca}%` } }
        ];
    }
    if (queryParams.municipio) { 
        whereFuncionario.municipio_local_trabalho = queryParams.municipio; 
    }
    if (queryParams.grupoContrato) {
        whereFuncionario.des_grupo_contrato = queryParams.grupoContrato;
    }
    if (queryParams.categoria) {
        whereFuncionario.categoria = queryParams.categoria;
    }
    if (queryParams.tipoContrato) {
        whereFuncionario.categoria_trab = queryParams.tipoContrato;
    }
    
    const { count, rows } = await Afastamento.findAndCountAll({
        where: {
            // Filtra por afastamentos que ainda não terminaram ou não têm data de fim
            [Op.or]: [
                { data_fim: { [Op.is]: null } },
                { data_fim: { [Op.gte]: new Date() } }
            ]
        },
        include: [{
            model: Funcionario,
            where: whereFuncionario,
            required: true
        }],
        order: [['data_inicio', 'DESC']],
        limit,
        offset,
    });

    const totalPages = Math.ceil(count / limit);
    return {
        data: rows,
        pagination: { totalItems: count, totalPages, currentPage: page, limit }
    };
};


/**
 * Cria um novo registro de afastamento para um funcionário.
 * @param {object} dadosAfastamento - Dados do afastamento (motivo, datas, matricula_funcionario).
 * @returns {Promise<object>} O objeto do afastamento criado.
 */
const create = async (dadosAfastamento) => {
  const funcionario = await Funcionario.findByPk(dadosAfastamento.matricula_funcionario);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado para associar o afastamento.');
  }

  const novoAfastamento = await Afastamento.create(dadosAfastamento);
  await feriasService.recalcularPeriodoAquisitivo(dadosAfastamento.matricula_funcionario);
  return novoAfastamento;
};

/**
 * Busca um único registro de afastamento pelo seu ID.
 * @param {number} id - O ID do afastamento.
 * @returns {Promise<object|null>} O objeto do afastamento ou nulo se não encontrado.
 */
const findOne = async (id) => {
  const afastamento = await Afastamento.findByPk(id);
  return afastamento;
};

/**
 * Atualiza um registro de afastamento.
 * @param {number} id - O ID do afastamento a ser atualizado.
 * @param {object} dadosParaAtualizar - Os novos dados para o afastamento.
 * @returns {Promise<object>} O objeto do afastamento atualizado.
 */
const update = async (id, dadosParaAtualizar) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  await afastamento.update(dadosParaAtualizar);
  await feriasService.recalcularPeriodoAquisitivo(afastamento.matricula_funcionario);
  return afastamento;
};

/**
 * Remove um registro de afastamento.
 * @param {number} id - O ID do afastamento a ser removido.
 * @returns {Promise<object>} Uma mensagem de sucesso.
 */
const remove = async (id) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  const matricula = afastamento.matricula_funcionario;
  await afastamento.destroy();
  await feriasService.recalcularPeriodoAquisitivo(matricula);
  return { message: 'Afastamento removido com sucesso.' };
};

module.exports = {
  findAllActive, // Exporta a nova função
  create,
  findOne,
  update,
  remove,
};