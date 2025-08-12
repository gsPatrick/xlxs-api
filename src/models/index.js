// src/models/index.js

const sequelize = require('../config/sequelize-instance');

// Importar todos os modelos
const Funcionario = require('./funcionario.model');
const Ferias = require('./ferias.model');
const Afastamento = require('./afastamento.model');
const Planejamento = require('./planejamento.model');

// Definir os relacionamentos entre os modelos

// Um Funcionário pode ter muitas Férias
Funcionario.hasMany(Ferias, { 
    foreignKey: 'matricula_funcionario', 
    as: 'historicoFerias', // Apelido para usar nos 'includes'
    onDelete: 'CASCADE' // Se um funcionário for deletado, suas férias também são.
});
Ferias.belongsTo(Funcionario, { foreignKey: 'matricula_funcionario' });

// Um Funcionário pode ter muitos Afastamentos
Funcionario.hasMany(Afastamento, {
    foreignKey: 'matricula_funcionario',
    as: 'historicoAfastamentos',
    onDelete: 'CASCADE'
});
Afastamento.belongsTo(Funcionario, { foreignKey: 'matricula_funcionario' });

// O relacionamento de Ferias com Planejamento já está definido em ferias.model.js,
// mas podemos confirmá-lo aqui se quisermos centralizar tudo.
// Planejamento.hasMany(Ferias, { foreignKey: 'planejamentoId', as: 'itensDeFerias' });
// Ferias.belongsTo(Planejamento, { foreignKey: 'planejamentoId' });

const db = {
    sequelize,
    Funcionario,
    Ferias,
    Afastamento,
    Planejamento
};

module.exports = db;