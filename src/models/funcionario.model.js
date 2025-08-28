// Em: src/models/funcionario.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');

const Funcionario = sequelize.define('Funcionario', {
  matricula: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
  nome_funcionario: { type: DataTypes.STRING, allowNull: false },
  dth_admissao: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'Ativo' },
  periodo_aquisitivo_atual_inicio: { type: DataTypes.DATEONLY },
  periodo_aquisitivo_atual_fim: { type: DataTypes.DATEONLY },
  dth_limite_ferias: { type: DataTypes.DATE },
  
  // CAMPOS NOVOS E AJUSTADOS DA PLANILHA
  dias_direito: { type: DataTypes.INTEGER, defaultValue: 30 }, // NOVO
  dias_planejados: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_saldo: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_programados: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_vendidos: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_gozados: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_abono: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO
  dias_faltas: { type: DataTypes.INTEGER, defaultValue: 0 }, // NOVO (qtdFaltas da planilha)
  
  faltas_injustificadas_periodo: { type: DataTypes.INTEGER, defaultValue: 0 }, // Mantido (pode ser o mesmo que dias_faltas)
  saldo_dias_ferias: { type: DataTypes.INTEGER, defaultValue: 30 }, // Mantido (será calculado com base nas faltas)
  
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
  proximo_periodo_aquisitivo_texto: { type: DataTypes.STRING },
  data_limite_filtro: { type: DataTypes.DATEONLY },
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
});

module.exports = Funcionario;