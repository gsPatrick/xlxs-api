// src/models/index.js

const { Sequelize } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const db = {};

db.Funcionario = require('./funcionario.model');
db.Ferias = require('./ferias.model');
db.Afastamento = require('./afastamento.model');
db.Planejamento = require('./planejamento.model');
db.User = require('./user.model');

// ==========================================================
// DEFINIÇÃO CORRETA E CENTRALIZADA DAS ASSOCIAÇÕES
// ==========================================================

// Um Funcionário pode ter muitas Férias.
// A chave estrangeira `matricula_funcionario` será adicionada ao modelo Ferias.
db.Funcionario.hasMany(db.Ferias, { 
    foreignKey: 'matricula_funcionario', 
    as: 'historicoFerias'
});
db.Ferias.belongsTo(db.Funcionario, { 
    foreignKey: 'matricula_funcionario' 
});

// Um Funcionário pode ter muitos Afastamentos.
// A chave estrangeira `matricula_funcionario` será adicionada ao modelo Afastamento.
db.Funcionario.hasMany(db.Afastamento, {
    foreignKey: 'matricula_funcionario',
    as: 'historicoAfastamentos'
});
db.Afastamento.belongsTo(db.Funcionario, { 
    foreignKey: 'matricula_funcionario' 
});

// Um Planejamento pode ter muitas Férias.
// A chave estrangeira `planejamentoId` será adicionada ao modelo Ferias.
db.Planejamento.hasMany(db.Ferias, { 
    foreignKey: 'planejamentoId', 
    as: 'itensDeFerias' 
});
db.Ferias.belongsTo(db.Planejamento, { 
    foreignKey: 'planejamentoId' 
});


db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;