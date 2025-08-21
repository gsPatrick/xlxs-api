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
  },
  periodo_aquisitivo_fim: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Planejada',
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  necessidade_substituicao: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
}, {
  tableName: 'ferias',
});

// REMOVA QUALQUER `Ferias.belongsTo` OU ASSOCIAÇÃO DESTE ARQUIVO

module.exports = Ferias;