// src/features/afastamento/afastamento.controller.js

const afastamentoService = require('./afastamento.service');

// ==========================================================
// NOVO CONTROLLER (SEÇÃO 2.A DO PDF)
// ==========================================================
const findAllActive = async (req, res) => {
    try {
        const resultado = await afastamentoService.findAllActive(req.query);
        res.status(200).send(resultado);
    } catch (error) {
        console.error('Erro no controller ao listar afastamentos ativos:', error);
        res.status(500).send({ message: 'Falha ao buscar afastamentos.', error: error.message });
    }
};

// Cria um novo afastamento para um funcionário
const create = async (req, res) => {
  try {
    const { matricula } = req.params;
    const dadosAfastamento = req.body;
    
    dadosAfastamento.matricula_funcionario = matricula;

    const novoAfastamento = await afastamentoService.create(dadosAfastamento);
    res.status(201).send(novoAfastamento);
  } catch (error) {
    console.error('Erro no controller ao criar afastamento:', error);
    res.status(500).send({ message: 'Falha ao registrar afastamento.', error: error.message });
  }
};

// Busca um único afastamento por ID
const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const afastamento = await afastamentoService.findOne(id);
    if (!afastamento) {
      return res.status(404).send({ message: 'Registro de afastamento não encontrado.' });
    }
    res.status(200).send(afastamento);
  } catch (error) {
    console.error('Erro no controller ao buscar afastamento:', error);
    res.status(500).send({ message: 'Falha ao buscar registro de afastamento.', error: error.message });
  }
};

// Atualiza um afastamento
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const afastamentoAtualizado = await afastamentoService.update(id, req.body);
    res.status(200).send(afastamentoAtualizado);
  } catch (error) {
    console.error('Erro no controller ao atualizar afastamento:', error);
    res.status(500).send({ message: 'Falha ao atualizar registro de afastamento.', error: error.message });
  }
};

// Remove um afastamento
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await afastamentoService.remove(id);
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error('Erro no controller ao remover afastamento:', error);
    res.status(500).send({ message: 'Falha ao remover registro de afastamento.', error: error.message });
  }
};

module.exports = {
  findAllActive, // Exporta o novo controller
  create,
  findOne,
  update,
  remove
};