// src/models/funcionario.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Funcionario = sequelize.define('Funcionario', {
  matricula: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  nome_funcionario: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dth_admissao: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  convencao: { type: DataTypes.STRING },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Ativo',
  },
  salario_base: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  // ==========================================================
  // COLUNA FALTANTE ADICIONADA
  // Esta coluna será preenchida com o valor da planilha.
  // ==========================================================
  afastamento: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Descrição do último status de afastamento, importado da planilha.'
  },
  
  // NOVOS CAMPOS PARA CONTROLE PRECISO
  periodo_aquisitivo_atual_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de início do período aquisitivo corrente.'
  },
  periodo_aquisitivo_atual_fim: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de fim do período aquisitivo corrente.'
  },
  dth_limite_ferias: {
    type: DataTypes.DATE,
    comment: 'Data limite para o gozo das férias.'
  },
  faltas_injustificadas_periodo: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de faltas injustificadas no período aquisitivo atual.'
  },
  saldo_dias_ferias: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Saldo de dias de férias, ajustado conforme as faltas.'
  }
}, {
  tableName: 'funcionarios',
  comment: 'Armazena os dados cadastrais e contratuais dos funcionários.'
});

module.exports = Funcionario;