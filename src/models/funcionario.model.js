// src/models/funcionario.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Funcionario = sequelize.define('Funcionario', {
  // --- Campos Principais (Existentes) ---
  matricula: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  nome_funcionario: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dth_admissao: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Ativo',
  },
  
  // --- Campos de Controle de Férias (Existentes, agora preenchidos pela planilha) ---
  periodo_aquisitivo_atual_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de início do período aquisitivo corrente (da planilha: ProximoPeriodoAquisitivoInicio).'
  },
  periodo_aquisitivo_atual_fim: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de fim do período aquisitivo corrente (da planilha: ProximoPeriodoAquisitivoFinal).'
  },
  dth_limite_ferias: {
    type: DataTypes.DATE,
    comment: 'Data limite para o gozo das férias (da planilha: DataLimite).'
  },
  faltas_injustificadas_periodo: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de faltas (da planilha: qtdFaltas).'
  },
  saldo_dias_ferias: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Saldo de dias de férias, ajustado conforme as faltas.'
  },

  // ==========================================================
  // NOVOS CAMPOS ADICIONADOS DA PLANILHA
  // ==========================================================
  
  // --- Detalhes do Contrato ---
  convencao: { 
    type: DataTypes.STRING,
    comment: 'Convenção coletiva de trabalho aplicável.'
  },
  categoria: {
    type: DataTypes.STRING,
    comment: 'Categoria/cargo do funcionário (Ex: "001 - AGENTE DE PORTARIA").'
  },
  categoria_trab: {
    type: DataTypes.STRING,
    comment: 'Classificação do vínculo (Ex: “Empregado - Geral”).'
  },
  horario: {
    type: DataTypes.STRING,
    comment: 'Jornada de trabalho (Ex: “12x36 DIURN 06:00-18:00”).'
  },
  escala: {
    type: DataTypes.STRING,
    comment: 'Escala de trabalho (Ex: “ESCALA 12 X 36”).'
  },
  
  // --- Detalhes do Local e Grupo ---
  municipio_local_trabalho: { // Campo existente que será populado pela nova planilha
    type: DataTypes.STRING 
  },
  sigla_local: {
    type: DataTypes.STRING,
    comment: 'Local de trabalho abreviado (Ex: “PI”).'
  },
  des_grupo_contrato: {
    type: DataTypes.STRING,
    comment: 'Descrição do grupo de contrato (Ex: “GERAL” ou “GS III”).'
  },
  id_grupo_contrato: {
    type: DataTypes.INTEGER,
    comment: 'Identificador numérico do grupo de contrato.'
  },
  
  // --- Status e Situação Atual ---
  situacao_ferias_afastamento_hoje: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Situação atual do funcionário (Ex: “Afastamento de: 20/11/2023 a 30/11/2026”).'
  },

  // --- Campos que existiam com outros nomes foram removidos ou adaptados ---
  // O campo 'afastamento' genérico foi removido em favor do 'situacao_ferias_afastamento_hoje'.

}, {
  tableName: 'funcionarios',
  comment: 'Armazena os dados cadastrais e contratuais dos funcionários.'
});

module.exports = Funcionario;