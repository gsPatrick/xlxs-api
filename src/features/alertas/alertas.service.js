// src/features/alertas/alertas.service.js

const { Afastamento, Funcionario, Ferias } = require('../../models');
const { Op } = require('sequelize');
const { addDays, startOfDay, subDays } = require('date-fns');

/**
 * Busca funcionários cujo afastamento termina nos próximos X dias.
 * @param {object} queryParams - Parâmetros da query, como { dias: 30 }.
 * @returns {Promise<Array<object>>} Uma lista de funcionários com retorno programado.
 */
const findRetornosProximos = async (queryParams) => {
    const dias = parseInt(queryParams.dias, 10);
    if (isNaN(dias) || dias <= 0) {
        throw new Error("O parâmetro 'dias' é obrigatório e deve ser um número positivo.");
    }

    const hoje = startOfDay(new Date());
    const dataLimite = addDays(hoje, dias);

    const afastamentos = await Afastamento.findAll({
        where: {
            data_fim: {
                [Op.between]: [hoje, dataLimite]
            }
        },
        include: [{
            model: Funcionario,
            attributes: ['matricula', 'nome_funcionario', 'status'],
            required: true
        }],
        order: [['data_fim', 'ASC']]
    });

    return afastamentos.map(af => ({
        matricula: af.Funcionario.matricula,
        nome_funcionario: af.Funcionario.nome_funcionario,
        status_funcionario: af.Funcionario.status,
        motivo_afastamento: af.motivo,
        data_retorno_prevista: af.data_fim
    }));
};

// ==========================================================
// NOVA FUNÇÃO (SEÇÃO 4.C DO PDF)
// ==========================================================
/**
 * Busca funcionários que retornaram de afastamento recentemente e não têm férias futuras planejadas.
 * @param {object} queryParams - Parâmetros da query, como { periodo: 30 } (dias no passado).
 * @returns {Promise<Array<object>>} Uma lista de funcionários que precisam de reprogramação de férias.
 */
const findNecessitaReprogramacao = async (queryParams) => {
    const periodo = parseInt(queryParams.periodo, 10) || 30; // Período padrão de 30 dias
    const hoje = startOfDay(new Date());
    const dataInicioBusca = subDays(hoje, periodo);

    // 1. Encontrar todos os funcionários que tiveram um afastamento encerrado recentemente
    const afastamentosRecentes = await Afastamento.findAll({
        where: {
            data_fim: {
                [Op.between]: [dataInicioBusca, hoje]
            }
        },
        attributes: ['matricula_funcionario'],
        raw: true
    });
    const matriculasRetornaram = [...new Set(afastamentosRecentes.map(af => af.matricula_funcionario))];

    if (matriculasRetornaram.length === 0) {
        return [];
    }

    // 2. Desses funcionários, encontrar quais já têm férias planejadas no futuro
    const feriasFuturas = await Ferias.findAll({
        where: {
            matricula_funcionario: { [Op.in]: matriculasRetornaram },
            data_inicio: { [Op.gt]: hoje },
            status: 'Planejada'
        },
        attributes: ['matricula_funcionario'],
        raw: true
    });
    const matriculasComFeriasAgendadas = new Set(feriasFuturas.map(f => f.matricula_funcionario));

    // 3. Filtrar para obter apenas os que retornaram e NÃO têm férias agendadas
    const matriculasParaReprogramar = matriculasRetornaram.filter(m => !matriculasComFeriasAgendadas.has(m));
    
    if (matriculasParaReprogramar.length === 0) {
        return [];
    }

    // 4. Buscar os dados completos dos funcionários que precisam de atenção
    const funcionarios = await Funcionario.findAll({
        where: {
            matricula: { [Op.in]: matriculasParaReprogramar },
            status: 'Ativo'
        },
        attributes: ['matricula', 'nome_funcionario', 'dth_limite_ferias'],
        order: [['nome_funcionario', 'ASC']]
    });

    return funcionarios;
};


module.exports = {
    findRetornosProximos,
    findNecessitaReprogramacao // Exporta a nova função
};