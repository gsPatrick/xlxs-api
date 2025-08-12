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

async function distribuirFerias(ano, descricao) {
    console.log(`Iniciando distribuição de férias para o ano ${ano}...`);

    // 1. Arquiva planejamentos ativos anteriores para o mesmo ano.
    await Planejamento.update({ status: 'arquivado' }, { where: { ano, status: 'ativo' } });
    
    // 2. Cria um novo registro de Planejamento.
    const novoPlanejamento = await Planejamento.create({
        ano,
        descricao: descricao || `Distribuição automática para ${ano}`,
        status: 'ativo'
    });

    // 3. Busca todos os funcionários elegíveis para o planejamento.
    // Regra 4.3: Não incluir colaboradores com "Aviso Prévio"
    const funcionariosElegiveis = await Funcionario.findAll({
        where: {
            status: 'Ativo',
            dth_limite_ferias: { [Op.not]: null },
            afastamento: { [Op.notIn]: ['Aviso Prévio', 'AVISO PREVIO'] } // Garante a exclusão
        },
        // Regra 1: Prioriza quem tem a DATA LIMITE mais próxima, para evitar pagamento em dobro.
        order: [['dth_limite_ferias', 'ASC']]
    });

    console.log(`${funcionariosElegiveis.length} funcionários elegíveis encontrados.`);
    
    // Simulação de feriados. Em um sistema real, isso viria de um DB ou API.
    const feriadosDoAno = [`${ano}-01-01`, `${ano}-04-21`, `${ano}-05-01`, `${ano}-09-07`, `${ano}-10-12`, `${ano}-11-02`, `${ano}-11-15`, `${ano}-12-25`];
    const feriasParaCriar = [];
    const calendarioOcupacao = {}; // Lógica para controle de cobertura (simplificado)

    for (const funcionario of funcionariosElegiveis) {
        // Regra 3: O saldo de dias já foi ajustado por faltas no recálculo.
        const diasDeFerias = funcionario.saldo_dias_ferias;
        if (diasDeFerias <= 0) {
            console.log(`Funcionário ${funcionario.matricula} sem saldo de férias.`);
            continue;
        }

        let dataInicioEncontrada = false;
        // Inicia a busca pela data de início do período concessivo do funcionário.
        let dataAtual = new Date(funcionario.periodo_aquisitivo_atual_inicio);
        const dataLimite = new Date(funcionario.dth_limite_ferias);

        // Loop para encontrar a primeira data válida para as férias
        while (!dataInicioEncontrada && dataAtual < dataLimite) {
            if (isDataValidaInicio(dataAtual, funcionario, feriadosDoAno)) {
                // Lógica de Cobertura (Regra 5)
                // Simplificação: não agendar mais de X pessoas do mesmo município no mesmo mês.
                const mes = dataAtual.getMonth();
                const municipio = funcionario.municipio_local_trabalho;
                const chaveOcupacao = `${municipio}-${mes}`;
                
                if (!calendarioOcupacao[chaveOcupacao]) {
                    calendarioOcupacao[chaveOcupacao] = 0;
                }

                // Limite de 5 funcionários por município/mês (exemplo)
                if (calendarioOcupacao[chaveOcupacao] < 5) {
                    const dataFim = addDays(dataAtual, diasDeFerias - 1);

                    feriasParaCriar.push({
                        matricula_funcionario: funcionario.matricula,
                        planejamentoId: novoPlanejamento.id,
                        data_inicio: format(dataAtual, 'yyyy-MM-dd'),
                        data_fim: format(dataFim, 'yyyy-MM-dd'),
                        qtd_dias: diasDeFerias,
                        periodo_aquisitivo_inicio: funcionario.periodo_aquisitivo_atual_inicio,
                        periodo_aquisitivo_fim: funcionario.periodo_aquisitivo_atual_fim,
                        status: 'Planejada'
                    });

                    calendarioOcupacao[chaveOcupacao]++;
                    dataInicioEncontrada = true;
                    console.log(`Férias alocadas para ${funcionario.matricula} a partir de ${format(dataAtual, 'dd/MM/yyyy')}.`);
                }
            }
            // Avança para o próximo dia
            dataAtual = addDays(dataAtual, 1);
        }

        if (!dataInicioEncontrada) {
            console.warn(`AVISO: Não foi possível alocar férias para o funcionário ${funcionario.matricula} antes da data limite.`);
        }
    }

    // 4. Salva todos os agendamentos de férias gerados no banco de dados.
    if (feriasParaCriar.length > 0) {
        await Ferias.bulkCreate(feriasParaCriar);
        console.log(`${feriasParaCriar.length} registros de férias foram criados.`);
    }

    return { message: `Distribuição para ${ano} concluída. ${feriasParaCriar.length} períodos de férias foram planejados.` };
}


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

    async function findAll(queryParams) {
    const whereClause = {};
    if (queryParams.planejamento === 'ativo') {
        whereClause['$Planejamento.status$'] = 'ativo';
    }
    // Adicionar outros filtros aqui no futuro

    return Ferias.findAll({
        where: whereClause,
        include: [
            { model: Funcionario, required: true },
            { model: Planejamento, required: true }
        ],
        order: [['data_inicio', 'ASC']]
    });
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
  findAll
};