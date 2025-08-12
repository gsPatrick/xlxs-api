// src/models/index.js

const { Sequelize } = require('sequelize');
const config = require('../config/database');
const sequelize = require('../config/sequelize-instance');

// O objeto `db` será nosso container principal para os modelos e a conexão.
const db = {};

// Importar todos os modelos e passá-los para o container `db`.
db.Funcionario = require('./funcionario.model');
db.Ferias = require('./ferias.model');
db.Afastamento = require('./afastamento.model');
db.Planejamento = require('./planejamento.model');
db.User = require('./user.model'); // Adicionar o User aqui

// Definir os relacionamentos entre os modelos
// É crucial fazer isso depois que todos os modelos foram carregados.

// Um Funcionário pode ter muitas Férias
db.Funcionario.hasMany(db.Ferias, { 
    foreignKey: 'matricula_funcionario', 
    as: 'historicoFerias',
    onDelete: 'CASCADE'
});
db.Ferias.belongsTo(db.Funcionario, { foreignKey: 'matricula_funcionario' });

// Um Funcionário pode ter muitos Afastamentos
db.Funcionario.hasMany(db.Afastamento, {
    foreignKey: 'matricula_funcionario',
    as: 'historicoAfastamentos',
    onDelete: 'CASCADE'
});
db.Afastamento.belongsTo(db.Funcionario, { foreignKey: 'matricula_funcionario' });

// Uma Férias pode pertencer a um Planejamento
db.Planejamento.hasMany(db.Ferias, { 
    foreignKey: 'planejamentoId', 
    as: 'itensDeFerias' 
});
db.Ferias.belongsTo(db.Planejamento, { foreignKey: 'planejamentoId' });


// Adicionar a instância do Sequelize e o próprio Sequelize ao objeto `db`.
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;