// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento } = require('../../models');
const { parse, addDays } = require('date-fns');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

// Lógica de importação de CSV (mantida e ajustada)
const importFromCSV = async (filePath) => {
  // ... (a lógica de importação que já tínhamos) ...
};

// Lógica de exportação, agora para XLSX
const exportAllToXLSX = async () => {
  const funcionarios = await Funcionario.findAll({ raw: true });
  const ws = XLSX.utils.json_to_sheet(funcionarios);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return { buffer, fileName: 'Relatorio_Funcionarios.xlsx' };
};

// Cria um novo funcionário
const create = async (dadosFuncionario) => {
  // Poderia ter validações aqui antes de criar
  const novoFuncionario = await Funcionario.create(dadosFuncionario);
  return novoFuncionario;
};

// Busca todos os funcionários com filtros avançados
const findAll = async (queryParams) => {
  const whereClause = {};

  // Filtro por nome ou matrícula
  if (queryParams.busca) {
    whereClause[Op.or] = [
      { nome_funcionario: { [Op.iLike]: `%${queryParams.busca}%` } },
      { matricula: { [Op.iLike]: `%${queryParams.busca}%` } }
    ];
  }

  // Filtro por status
  if (queryParams.status) {
    whereClause.status = queryParams.status;
  }
  
  // Filtro rápido do dashboard
  if (queryParams.filtro) {
    const hoje = new Date();
    if (queryParams.filtro === 'vencidas') {
      whereClause.dth_limite_ferias = { [Op.lt]: hoje };
    }
    if (queryParams.filtro === 'risco_iminente') {
      const dataLimiteRisco = addDays(hoje, 30);
      whereClause.dth_limite_ferias = { [Op.between]: [hoje, dataLimiteRisco] };
    }
  }

  const funcionarios = await Funcionario.findAll({
    where: whereClause,
    order: [['nome_funcionario', 'ASC']]
  });
  return funcionarios;
};

// Busca um único funcionário com seus relacionamentos
const findOne = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula, {
    include: [
      {
        model: Ferias,
        as: 'historicoFerias',
        order: [['data_inicio', 'DESC']],
      },
      {
        model: Afastamento,
        as: 'historicoAfastamentos',
        order: [['data_inicio', 'DESC']],
      }
    ]
  });
  return funcionario;
};

// Atualiza os dados de um funcionário
const update = async (matricula, dadosParaAtualizar) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado');
  }
  // Remove a matrícula do objeto de atualização para evitar alteração da PK
  delete dadosParaAtualizar.matricula;
  
  await funcionario.update(dadosParaAtualizar);
  return funcionario;
};

// Remove um funcionário do banco de dados
const remove = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado');
  }
  await funcionario.destroy();
  return { message: 'Funcionário removido com sucesso.' };
};


module.exports = {
  importFromCSV,
  exportAllToXLSX,
  create,
  findAll,
  findOne,
  update,
  remove,
};