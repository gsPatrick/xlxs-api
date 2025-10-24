// src/models/substituto.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Substituto = sequelize.define('Substituto', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  matricula_funcionario: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Um funcionário só pode ser um substituto uma vez
    references: {
      model: 'funcionarios', // Nome da tabela
      key: 'matricula',
    }
  },
  cargos_aptos: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Ex: ['Recepcionista', 'Porteiro']
    allowNull: true,
    comment: 'Lista de cargos que este substituto está apto a cobrir.'
  },
  status: {
    type: DataTypes.STRING, // 'Disponível', 'Alocado'
    defaultValue: 'Disponível',
  }
}, {
  tableName: 'substitutos',
  comment: 'Registra os funcionários que atuam como substitutos.'
});

module.exports = Substituto;