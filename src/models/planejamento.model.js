// src/models/planejamento.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Planejamento = sequelize.define('Planejamento', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ano: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING, // 'ativo', 'arquivado'
    allowNull: false,
    defaultValue: 'ativo',
  },
  descricao: {
    type: DataTypes.STRING, // Ex: "Planejamento inicial 2025", "Recalculado após importação de 15/02"
  },
  criado_em: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'planejamentos',
});

module.exports = Planejamento;