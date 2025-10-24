// src/models/index.js

const { Sequelize } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const db = {};

// 1. IMPORTAÇÃO DE TODOS OS MODELOS
db.Funcionario = require('./funcionario.model');
db.Ferias = require('./ferias.model');
db.Afastamento = require('./afastamento.model');
db.Planejamento = require('./planejamento.model');
db.User = require('./user.model');
db.Substituto = require('./substituto.model'); // <-- NOVO MODELO IMPORTADO

// ==========================================================
// 2. DEFINIÇÃO CORRETA E CENTRALIZADA DAS ASSOCIAÇÕES
// ==========================================================

// Um Funcionário pode ter muitas Férias.
db.Funcionario.hasMany(db.Ferias, { 
    foreignKey: 'matricula_funcionario', 
    as: 'historicoFerias'
});
db.Ferias.belongsTo(db.Funcionario, { 
    foreignKey: 'matricula_funcionario' 
});

// Um Funcionário pode ter muitos Afastamentos.
db.Funcionario.hasMany(db.Afastamento, {
    foreignKey: 'matricula_funcionario',
    as: 'historicoAfastamentos'
});
db.Afastamento.belongsTo(db.Funcionario, { 
    foreignKey: 'matricula_funcionario' 
});

// Um Planejamento pode ter muitas Férias.
db.Planejamento.hasMany(db.Ferias, { 
    foreignKey: 'planejamentoId', 
    as: 'itensDeFerias' 
});
db.Ferias.belongsTo(db.Planejamento, { 
    foreignKey: 'planejamentoId' 
});

// ==========================================================
// NOVAS ASSOCIAÇÕES PARA O MODELO SUBSTITUTO
// ==========================================================

// Um Funcionário pode ser (ou ter) um registro de Substituto (Relação 1-para-1).
db.Funcionario.hasOne(db.Substituto, {
    foreignKey: 'matricula_funcionario'
});
db.Substituto.belongsTo(db.Funcionario, {
    foreignKey: 'matricula_funcionario'
});

// Um Substituto pode estar alocado em muitos Períodos de Férias.
db.Substituto.hasMany(db.Ferias, {
    foreignKey: 'substituto_id',
    as: 'alocacoes' // Ex: para buscar todas as férias que um substituto está cobrindo
});
// Um Período de Férias pertence a um (e apenas um) Substituto.
db.Ferias.belongsTo(db.Substituto, {
    foreignKey: 'substituto_id',
    as: 'substitutoAlocado' // Ex: para buscar os dados do substituto a partir de um registro de férias
});


// 3. ADICIONAR INSTÂNCIAS AO OBJETO DB PARA EXPORTAÇÃO
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;