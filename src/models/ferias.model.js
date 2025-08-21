// src/models/funcionario.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Funcionario = sequelize.define('Funcionario', {
  // --- Campos Principais (Existentes) ---
  matricula: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
  nome_funcionario: { type: DataTypes.STRING, allowNull: false },
  dth_admissao: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'Ativo' },
  
  // --- Campos de Controle de Férias (Existentes) ---
  periodo_aquisitivo_atual_inicio: { type: DataTypes.DATEONLY, comment: 'da planilha: ProximoPeriodoAquisitivoInicio' },
  periodo_aquisitivo_atual_fim: { type: DataTypes.DATEONLY, comment: 'da planilha: ProximoPeriodoAquisitivoFinal' },
  dth_limite_ferias: { type: DataTypes.DATE, comment: 'da planilha: DataLimite' },
  faltas_injustificadas_periodo: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'da planilha: qtdFaltas' },
  saldo_dias_ferias: { type: DataTypes.INTEGER, defaultValue: 30 },

  // --- Detalhes do Contrato e Local (Existentes) ---
  convencao: { type: DataTypes.STRING },
  categoria: { type: DataTypes.STRING },
  categoria_trab: { type: DataTypes.STRING },
  horario: { type: DataTypes.STRING },
  escala: { type: DataTypes.STRING },
  municipio_local_trabalho: { type: DataTypes.STRING },
  sigla_local: { type: DataTypes.STRING },
  des_grupo_contrato: { type: DataTypes.STRING },
  id_grupo_contrato: { type: DataTypes.INTEGER },
  situacao_ferias_afastamento_hoje: { type: DataTypes.STRING },

  // ====================================================================
  // NOVOS CAMPOS ADICIONADOS PARA ESPELHAR 100% A PLANILHA
  // ====================================================================
  proximo_periodo_aquisitivo_texto: { type: DataTypes.STRING, comment: 'Campo de texto (ex: 01/04/2025 - 31/03/2026)' },
  data_limite_filtro: { type: DataTypes.DATEONLY, comment: 'Campo DataLimiteFiltro da planilha' },
  ultima_data_planejada: { type: DataTypes.DATEONLY },
  ultima_data_planejada_mes: { type: DataTypes.INTEGER },
  ano_ultima_data_planejada: { type: DataTypes.INTEGER },
  qtd_periodos_planejados: { type: DataTypes.INTEGER },
  qtd_periodos_gozo: { type: DataTypes.INTEGER },
  qtd_periodos_pendentes: { type: DataTypes.INTEGER },
  qtd_periodos_completos: { type: DataTypes.INTEGER },
  qtd_periodos_incompletos: { type: DataTypes.INTEGER },
  qtd_periodos_individuais: { type: DataTypes.INTEGER },
  qtd_periodos_coletivos: { type: DataTypes.INTEGER },

}, {
  tableName: 'funcionarios',
  comment: 'Armazena os dados cadastrais e contratuais dos funcionários.'
});

module.exports = Funcionario;