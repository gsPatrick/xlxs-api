// src/features/ferias/ferias.service.js

const { Op } = require('sequelize');
const { parseISO, addDays, getDay, isBefore, format, addYears, addMonths, differenceInDays, isWithinInterval } = require('date-fns');
const { Parser } = require('json2csv');
const { Funcionario, Ferias, Afastamento, Planejamento } = require('../../models');

// --- FUNÇÃO CENTRAL DE REGRAS DE NEGÓCIO ---

/**
 * RECALCULA O PERÍODO AQUISITIVO E O SALDO DE FÉRIAS DE UM FUNCIONÁRIO.
 * Esta função é o cérebro do sistema para conformidade com as regras de férias.
 * É acionada sempre que um afastamento ou falta é registrado/modificado.
 * 
 * @param {string} matricula - A matrícula do funcionário a ser recalculado.
 */
async function recalcularPeriodoAquisitivo(matricula) {
  const funcionario = await Funcionario.findByPk(matricula, {
    include: [{ model: Afastamento, as: 'historicoAfastamentos' }]
  });

  if (!funcionario) {
    throw new Error(`Funcionário com matrícula ${matricula} não encontrado para recálculo.`);
  }

  // 1. Determina o período aquisitivo base (sem considerar afastamentos)
  const hoje = new Date();
  const anosDeEmpresa = differenceInDays(hoje, funcionario.dth_admissao) / 365.25;
  const ultimoAniversarioDeEmpresa = addYears(funcionario.dth_admissao, Math.floor(anosDeEmpresa));
  
  let periodoBaseInicio = ultimoAniversarioDeEmpresa;
  if (periodoBaseInicio > hoje) {
      periodoBaseInicio = addYears(periodoBaseInicio, -1);
  }
  let periodoBaseFim = addDays(addYears(periodoBaseInicio, 1), -1);

  // 2. Analisa os afastamentos dentro do período aquisitivo base
  let diasDeAfastamentoDoenca = 0;
  let diasDeAfastamentoSuspensao = 0;

  if (funcionario.historicoAfastamentos) {
    for (const af of funcionario.historicoAfastamentos) {
      if (!af.impacta_ferias) continue;

      const intervaloAfastamento = { start: new Date(af.data_inicio), end: new Date(af.data_fim || hoje) };
      const intervaloPeriodo = { start: new Date(periodoBaseInicio), end: new Date(periodoBaseFim) };

      if (isWithinInterval(intervaloAfastamento.start, intervaloPeriodo) || isWithinInterval(intervaloAfastamento.end, intervaloPeriodo)) {
        const diasNoPeriodo = differenceInDays(intervaloAfastamento.end, intervaloAfastamento.start) + 1;
        
        if (af.motivo.toLowerCase().includes('doença') || af.motivo.toLowerCase().includes('acidente')) {
          diasDeAfastamentoDoenca += diasNoPeriodo;
        }
        if (af.motivo.toLowerCase().includes('licença não remunerada') || af.motivo.toLowerCase().includes('cárcere')) {
          diasDeAfastamentoSuspensao += diasNoPeriodo;
        }
      }
    }
  }

  // 3. Aplica as Regras de Impacto
  if (diasDeAfastamentoDoenca > 180) { // ZERA o período
    const ultimoAfastamentoRelevante = funcionario.historicoAfastamentos.find(af => af.motivo.toLowerCase().includes('doença'));
    const dataRetorno = addDays(new Date(ultimoAfastamentoRelevante.data_fim), 1);
    
    funcionario.periodo_aquisitivo_atual_inicio = dataRetorno;
    funcionario.periodo_aquisitivo_atual_fim = addDays(addYears(dataRetorno, 1), -1);
  } else { // SUSPENDE o período
    const novoFimPeriodo = addDays(periodoBaseFim, diasDeAfastamentoSuspensao);
    funcionario.periodo_aquisitivo_atual_inicio = periodoBaseInicio;
    funcionario.periodo_aquisitivo_atual_fim = novoFimPeriodo;
  }
  
  funcionario.dth_limite_ferias = addMonths(funcionario.periodo_aquisitivo_atual_fim, 11);
  
  // 4. Aplica Redução do SALDO de dias por Faltas
  const faltas = funcionario.faltas_injustificadas_periodo || 0;
  if (faltas <= 5) funcionario.saldo_dias_ferias = 30;
  else if (faltas <= 14) funcionario.saldo_dias_ferias = 24;
  else if (faltas <= 23) funcionario.saldo_dias_ferias = 18;
  else if (faltas <= 32) funcionario.saldo_dias_ferias = 12;
  else funcionario.saldo_dias_ferias = 0;

  await funcionario.save();
  return funcionario;
}


// --- LÓGICA DE DISTRIBUIÇÃO AUTOMÁTICA ---

const distribuirFerias = async (ano, descricao) => {
  await Planejamento.update({ status: 'arquivado' }, { where: { ano: ano, status: 'ativo' } });
  const novoPlanejamento = await Planejamento.create({ ano, descricao: descricao || `Planejamento gerado em ${new Date().toLocaleDateString()}`, status: 'ativo' });
  
  const funcionarios = await Funcionario.findAll({
    where: { status: 'Ativo', afastamento: { [Op.not]: 'Aviso Prévio' } },
    order: [['dth_limite_ferias', 'ASC']]
  });

  const feriasParaCriar = [];
  for (const func of funcionarios) {
    // A lógica de distribuição usará os dados já calculados e atualizados do funcionário
    // (saldo_dias_ferias, dth_limite_ferias, etc)
    const diasDeFerias = func.saldo_dias_ferias;
    if (diasDeFerias <= 0) continue;
    
    // ... (lógica de encontrar data válida, como já tínhamos) ...
    // Placeholder para a lógica de encontrar data:
    const dataInicio = new Date(`${ano}-03-01`); // Simulação
    const dataFim = addDays(dataInicio, diasDeFerias - 1);

    feriasParaCriar.push({
      matricula_funcionario: func.matricula,
      data_inicio: format(dataInicio, 'yyyy-MM-dd'),
      data_fim: format(dataFim, 'yyyy-MM-dd'),
      qtd_dias: diasDeFerias,
      planejamentoId: novoPlanejamento.id,
      periodo_aquisitivo_inicio: func.periodo_aquisitivo_atual_inicio,
      periodo_aquisitivo_fim: func.periodo_aquisitivo_atual_fim,
      status: 'Planejada'
    });
  }

  if (feriasParaCriar.length > 0) {
    await Ferias.bulkCreate(feriasParaCriar);
  }

  return { message: `Novo planejamento criado para o ano ${ano}.`, registros: feriasParaCriar.length };
};


// --- CRUD E OUTRAS FUNCIONALIDADES DE FÉRIAS ---

const createFerias = async (dadosFerias) => {
    // Aqui implementamos a validação de cobertura/conflitos
    // Ex: verificar se já existem muitas pessoas da mesma equipe/local de férias no mesmo período.
    // if (coberturaExcedida) throw new Error('Limite de cobertura para o período excedido.');

    return Ferias.create(dadosFerias);
};

const listarFerias = async (filtros) => {
  const whereClause = { ferias: {}, funcionario: {}, planejamento: { status: 'ativo' } };
  // ... (lógica de filtros como já tínhamos) ...
  return Ferias.findAll({ where: whereClause.ferias, include: [/*...*/] });
};

const atualizarFeria = async (id, dados) => {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    return feria.update(dados);
};

const removeFeria = async (id) => {
    const feria = await Ferias.findByPk(id);
    if (!feria) throw new Error('Período de férias não encontrado.');
    return feria.destroy();
};


// --- GESTÃO DE HISTÓRICO DE PLANEJAMENTOS ---

const listarPlanejamentosPorAno = async (ano) => {
  return Planejamento.findAll({ where: { ano }, order: [['criado_em', 'DESC']] });
};

const restaurarPlanejamento = async (planejamentoId) => {
    const t = await sequelize.transaction();
    try {
        const planejamentoParaAtivar = await Planejamento.findByPk(planejamentoId);
        if (!planejamentoParaAtivar) throw new Error("Planejamento não encontrado.");

        await Planejamento.update({ status: 'arquivado' }, { where: { ano: planejamentoParaAtivar.ano, status: 'ativo' }, transaction: t });
        
        planejamentoParaAtivar.status = 'ativo';
        await planejamentoParaAtivar.save({ transaction: t });

        await t.commit();
        return planejamentoParaAtivar;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

module.exports = {
  // Função principal de regras de negócio
  recalcularPeriodoAquisitivo,
  
  // Funções de planejamento e distribuição
  distribuirFerias,
  listarPlanejamentosPorAno,
  restaurarPlanejamento,

  // Funções CRUD para férias individuais
  createFerias,
  listarFerias,
  atualizarFeria,
  removeFeria,
};