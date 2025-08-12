// src/models/afastamento.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Afastamento = sequelize.define('Afastamento', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  motivo: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Descrição do motivo do afastamento (Ex: Licença Médica, INSS, Licença Maternidade).'
  },
  data_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Data de início do afastamento.'
  },
  data_fim: {
    type: DataTypes.DATEONLY,
    allowNull: true, // Pode ser nulo se o afastamento estiver em aberto
    comment: 'Data de término do afastamento.'
  },
  impacta_ferias: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Indica se este tipo de afastamento impacta na contagem do período aquisitivo.'
  }
}, {
  tableName: 'afastamentos',
  comment: 'Registra os períodos de afastamento dos funcionários.'
});

module.exports = Afastamento;