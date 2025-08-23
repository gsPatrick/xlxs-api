// src/features/afastamento/afastamento.controller.js

const afastamentoService = require('./afastamento.service');

const findAllActive = async (req, res) => {
    try {
        const resultado = await afastamentoService.findAllActive(req.query);
        res.status(200).send(resultado);
    } catch (error) {
        console.error('Erro no controller ao listar afastamentos ativos:', error);
        res.status(500).send({ message: 'Falha ao buscar afastamentos.', error: error.message });
    }
};

const create = async (req, res) => {
  try {
    const { matricula } = req.params;
    const dadosAfastamento = req.body;
    dadosAfastamento.matricula_funcionario = matricula;
    const novoAfastamento = await afastamentoService.create(dadosAfastamento);
    res.status(201).send(novoAfastamento);
  } catch (error) {
    res.status(500).send({ message: 'Falha ao registrar afastamento.', error: error.message });
  }
};

const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const afastamento = await afastamentoService.findOne(id);
    if (!afastamento) {
      return res.status(404).send({ message: 'Registro de afastamento não encontrado.' });
    }
    res.status(200).send(afastamento);
  } catch (error) {
    res.status(500).send({ message: 'Falha ao buscar registro de afastamento.', error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const afastamentoAtualizado = await afastamentoService.update(id, req.body);
    res.status(200).send(afastamentoAtualizado);
  } catch (error) {
    res.status(500).send({ message: 'Falha ao atualizar registro de afastamento.', error: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await afastamentoService.remove(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).send({ message: 'Falha ao remover registro de afastamento.', error: error.message });
  }
};

// NOVO: Controlador para exclusão em massa
const bulkRemove = async (req, res) => {
    try {
        const { ids } = req.body;
        const result = await afastamentoService.bulkRemove(ids);
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao remover afastamentos em massa.', error: error.message });
    }
};

module.exports = {
  findAllActive,
  create,
  findOne,
  update,
  remove,
  bulkRemove // Exporta o novo controlador
};