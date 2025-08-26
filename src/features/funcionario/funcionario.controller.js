// src/features/funcionario/funcionario.controller.js

const funcionarioService = require('./funcionario.service');

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

// Renomeado para 'importFile' para ser genérico (aceita XLSX)
const importFile = async (req, res) => {
  console.log('[LOG CONTROLLER] Requisição de importação recebida.');

  try {
    if (!req.file) {
      console.log('[LOG CONTROLLER] Erro: Nenhum arquivo enviado.');
      return res.status(400).send({ message: 'Nenhum arquivo enviado.' });
    }
    
    console.log(`[LOG CONTROLLER] Arquivo recebido: ${req.file.originalname}`);
    
    // ==========================================================
    // CAPTURA DAS DATAS VINDAS DO FORMULÁRIO
    // ==========================================================
    const { data_inicio_distribuicao, data_fim_distribuicao } = req.body;
    
    console.log('[LOG CONTROLLER] Chamando o serviço importFromXLSX com as opções:', { data_inicio_distribuicao, data_fim_distribuicao });

    const result = await funcionarioService.importFromXLSX(req.file.path, {
        data_inicio_distribuicao,
        data_fim_distribuicao
    });

    console.log('[LOG CONTROLLER] Serviço executado com sucesso. Enviando resposta.');
    res.status(200).send(result);

  } catch (error) {
    console.error('[ERRO CONTROLLER] Falha na importação:', error);
    res.status(500).send({ message: 'Falha ao processar o arquivo.', error: error.message });
  }
};

// ==========================================================
// NOVO CONTROLLER
// ==========================================================
const getFilterOptions = async (req, res) => {
    try {
        const options = await funcionarioService.getFilterOptions();
        res.status(200).send(options);
    } catch (error) {
        console.error('Erro no controller ao buscar opções de filtro:', error);
        res.status(500).send({ message: 'Falha ao buscar opções de filtro.', error: error.message });
    }
};

module.exports = {
  create,
  findAll,
  findOne,
  update,
  remove,
  exportAll,
  importFile,
  getFilterOptions, // Exporta o novo controller
};