// src/models/ferias.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');
const Planejamento = require('./planejamento.model');

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
  }
}, {
  tableName: 'ferias',
  comment: 'Armazena os períodos de férias agendados ou gozados.'
});

// O relacionamento com Planejamento é mantido para o histórico de distribuições automáticas.
Planejamento.hasMany(Ferias, { foreignKey: 'planejamentoId', as: 'itensDeFerias' });
Ferias.belongsTo(Planejamento, { foreignKey: 'planejamentoId' });

module.exports = Ferias;