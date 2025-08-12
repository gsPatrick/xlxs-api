// src/features/afastamento/afastamento.service.js

const { Afastamento, Funcionario } = require('../../models');
// Importar o serviço de férias para usar a função de recálculo
const feriasService = require('../ferias/ferias.service');

/**
 * Cria um novo registro de afastamento para um funcionário.
 * @param {object} dadosAfastamento - Dados do afastamento (motivo, datas, matricula_funcionario).
 * @returns {Promise<object>} O objeto do afastamento criado.
 */
const create = async (dadosAfastamento) => {
  // Validação: Verifica se o funcionário existe antes de criar o afastamento
  const funcionario = await Funcionario.findByPk(dadosAfastamento.matricula_funcionario);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado para associar o afastamento.');
  }

  const novoAfastamento = await Afastamento.create(dadosAfastamento);

  // Aciona a lógica de regras de negócio para recalcular o período de férias
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

  // Aciona a lógica de regras de negócio para recalcular o período de férias
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

  // Aciona a lógica de regras de negócio para recalcular o período de férias
  await feriasService.recalcularPeriodoAquisitivo(matricula);

  return { message: 'Afastamento removido com sucesso.' };
};

module.exports = {
  create,
  findOne,
  update,
  remove,
};