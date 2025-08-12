// src/features/funcionario/funcionario.controller.js

const funcionarioService = require('./funcionario.service');

// Importa uma planilha CSV
const importCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'Nenhum arquivo enviado.' });
    }
    const result = await funcionarioService.importFromCSV(req.file.path);
    res.status(200).send(result);
  } catch (error) {
    console.error('Erro no controller ao importar CSV:', error);
    res.status(500).send({ message: 'Falha ao processar o arquivo CSV.', error: error.message });
  }
};

// Adiciona um novo funcionário
const create = async (req, res) => {
  try {
    const novoFuncionario = await funcionarioService.create(req.body);
    res.status(201).send(novoFuncionario);
  } catch (error) {
    console.error('Erro no controller ao criar funcionário:', error);
    if(error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).send({ message: 'Matrícula já existente.' });
    }
    res.status(500).send({ message: 'Falha ao criar funcionário.', error: error.message });
  }
};

// Lista todos os funcionários com filtros
const findAll = async (req, res) => {
  try {
    const funcionarios = await funcionarioService.findAll(req.query);
    res.status(200).send(funcionarios);
  } catch (error) {
    console.error('Erro no controller ao listar funcionários:', error);
    res.status(500).send({ message: 'Falha ao buscar funcionários.', error: error.message });
  }
};

// Busca um único funcionário por matrícula
const findOne = async (req, res) => {
  try {
    const { matricula } = req.params;
    const funcionario = await funcionarioService.findOne(matricula);
    if (!funcionario) {
      return res.status(404).send({ message: 'Funcionário não encontrado.' });
    }
    res.status(200).send(funcionario);
  } catch (error) {
    console.error('Erro no controller ao buscar funcionário:', error);
    res.status(500).send({ message: 'Falha ao buscar funcionário.', error: error.message });
  }
};

// Atualiza um funcionário
const update = async (req, res) => {
  try {
    const { matricula } = req.params;
    const funcionarioAtualizado = await funcionarioService.update(matricula, req.body);
    res.status(200).send(funcionarioAtualizado);
  } catch (error) {
    console.error('Erro no controller ao atualizar funcionário:', error);
    res.status(500).send({ message: 'Falha ao atualizar funcionário.', error: error.message });
  }
};

// Remove um funcionário
const remove = async (req, res) => {
  try {
    const { matricula } = req.params;
    await funcionarioService.remove(matricula);
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error('Erro no controller ao remover funcionário:', error);
    res.status(500).send({ message: 'Falha ao remover funcionário.', error: error.message });
  }
};

// Exporta os dados
const exportAll = async (req, res) => {
    try {
        const { buffer, fileName } = await funcionarioService.exportAllToXLSX();
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Erro no controller ao exportar dados:', error);
        res.status(500).send({ message: 'Falha ao exportar dados.', error: error.message });
    }
};

module.exports = {
  importCSV,
  create,
  findAll,
  findOne,
  update,
  remove,
  exportAll
};