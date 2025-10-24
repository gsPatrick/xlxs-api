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
    defaultValue: 'Planejada', // Ex: Planejada, Confirmada, Em Gozo, Cancelada
  },
  observacao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // ==========================================================
  // ALTERAÇÃO 1: O valor padrão foi alterado de 'false' para 'true'
  // ==========================================================
  necessidade_substituicao: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true, // ALTERADO
    comment: 'Indica se o funcionário precisa de um substituto durante as férias.'
  },
  // ==========================================================
  // ALTERAÇÃO 2: Novo campo adicionado
  // ==========================================================
  ajuste_manual: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica se este registro foi criado ou alterado manualmente pelo usuário.'
  }
}, {
  tableName: 'ferias',
});

module.exports = Ferias;