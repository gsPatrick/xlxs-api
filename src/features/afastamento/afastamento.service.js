// src/features/afastamento/afastamento.service.js

const { Afastamento, Funcionario } = require('../../models');
// Importar o serviço de férias para usar a função de recálculo
const feriasService = require('../ferias/ferias.service');

const create = async (dadosAfastamento) => {
  const funcionario = await Funcionario.findByPk(dadosAfastamento.matricula_funcionario);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado para associar o afastamento.');
  }

  const novoAfastamento = await Afastamento.create(dadosAfastamento);

  // **CHAMADA PARA A LÓGICA DE REGRAS DE NEGÓCIO**
  await feriasService.recalcularPeriodoAquisitivo(dadosAfastamento.matricula_funcionario);

  return novoAfastamento;
};

const update = async (id, dadosParaAtualizar) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  await afastamento.update(dadosParaAtualizar);

  // **CHAMADA PARA A LÓGICA DE REGRAS DE NEGÓCIO**
  await feriasService.recalcularPeriodoAquisitivo(afastamento.matricula_funcionario);

  return afastamento;
};

const remove = async (id) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  const matricula = afastamento.matricula_funcionario;
  await afastamento.destroy();

  // **CHAMADA PARA A LÓGICA DE REGRAS DE NEGÓCIO**
  await feriasService.recalcularPeriodoAquisitivo(matricula);

  return { message: 'Afastamento removido com sucesso.' };
};

const findOne = async (id) => {
  const afastamento = await Afastamento.findByPk(id);
  return afastamento;
};

module.exports = {
  create,
  findOne,
  update,
  remove,
};