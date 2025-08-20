// src/models/ferias.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Ferias = sequelize.define('Ferias', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  data_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  data_fim: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  qtd_dias: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  periodo_aquisitivo_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de início do período aquisitivo a que estas férias se referem.'
  },
  periodo_aquisitivo_fim: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de fim do período aquisitivo a que estas férias se referem.'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Planejada',
    comment: 'Status do agendamento (Ex: Solicitada, Aprovada, Planejada, Confirmada, Gozada, Recusada).'
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Campo para justificativas (ex: motivo da recusa).'
  },
  // ==========================================================
  // NOVO CAMPO ADICIONADO (SEÇÃO 4.B DO PDF)
  // ==========================================================
  necessidade_substituicao: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica se o colaborador precisa ser substituído durante as férias.'
  }
}, {
  tableName: 'ferias',
  comment: 'Armazena os períodos de férias agendados ou gozados.'
});

module.exports = Ferias;