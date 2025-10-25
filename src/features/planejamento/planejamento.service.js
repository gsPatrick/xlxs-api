// src/features/planejamento/planejamento.service.js

const { Planejamento, Ferias, Afastamento, Funcionario } = require('../../models');
const db = require('../../models');
const { startOfMonth, endOfMonth, startOfYear, endOfYear } = require('date-fns');
const { Op } = require('sequelize');

/**
 * Busca o histórico de planejamentos, com opção de filtro por ano.
 */
const findAll = async (queryParams) => {
    const whereClause = {};
    if(queryParams.ano) {
        whereClause.ano = queryParams.ano;
    }
    return Planejamento.findAll({
        where: whereClause,
        order: [['ano', 'DESC'], ['criado_em', 'DESC']]
    });
};

/**
 * Ativa (restaura) um planejamento arquivado, arquivando o que estava ativo anteriormente para o mesmo ano.
 */
const ativar = async (id) => {
    const t = await db.sequelize.transaction();
    try {
        const planejamentoParaAtivar = await Planejamento.findByPk(id, { transaction: t });
        if (!planejamentoParaAtivar) {
            throw new Error('Planejamento não encontrado.');
        }

        // Arquiva qualquer outro planejamento que esteja ativo para o mesmo ano
        await Planejamento.update(
            { status: 'arquivado' },
            { 
                where: { 
                    ano: planejamentoParaAtivar.ano, 
                    status: 'ativo',
                    id: { [Op.ne]: id } // Não arquiva o próprio planejamento que estamos prestes a ativar
                }, 
                transaction: t 
            }
        );

        planejamentoParaAtivar.status = 'ativo';
        await planejamentoParaAtivar.save({ transaction: t });

        await t.commit();
        return planejamentoParaAtivar;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};

/**
 * Busca uma visão geral de todas as ausências (férias e afastamentos)
 * para um determinado ano (e opcionalmente mês), com filtros.
 * VERSÃO CORRIGIDA
 */
const getVisaoGeral = async (queryParams) => {
    const ano = parseInt(queryParams.ano, 10);
    
    if (!ano) {
        throw new Error("O ano é obrigatório.");
    }

    // Define o intervalo de busca para o ano inteiro
    const inicioBusca = startOfYear(new Date(ano, 0, 1));
    const fimBusca = endOfYear(new Date(ano, 11, 31));

    // Condição para encontrar qualquer evento que se sobreponha ao período de busca do ano
    const whereEventos = {
        [Op.or]: [
            { data_inicio: { [Op.between]: [inicioBusca, fimBusca] } },
            { data_fim: { [Op.between]: [inicioBusca, fimBusca] } },
            { [Op.and]: [ { data_inicio: { [Op.lte]: fimBusca } }, { data_fim: { [Op.gte]: inicioBusca } } ]}
        ]
    };

    // Busca todas as férias no período, incluindo os dados completos do funcionário para filtragem no frontend
    const feriasNoPeriodo = await Ferias.findAll({
        where: whereEventos,
        include: [{ 
            model: Funcionario,
            required: true // Garante que só traga férias de funcionários existentes
        }]
    });

    // Busca todos os afastamentos no período, incluindo os dados completos do funcionário
    const afastamentosNoPeriodo = await Afastamento.findAll({
        where: whereEventos,
        include: [{ 
            model: Funcionario,
            required: true
        }]
    });

    const eventos = [];
    feriasNoPeriodo.forEach(f => {
        eventos.push({
            id: `ferias-${f.id}`,
            tipo: 'Férias',
            data_inicio: f.data_inicio,
            data_fim: f.data_fim,
            status: f.status,
            // Adiciona o objeto completo do funcionário para permitir a filtragem no frontend
            Funcionario: f.Funcionario.toJSON() 
        });
    });

    afastamentosNoPeriodo.forEach(a => {
        eventos.push({
            id: `afastamento-${a.id}`,
            tipo: 'Afastamento',
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            status: a.motivo,
            // Adiciona o objeto completo do funcionário
            Funcionario: a.Funcionario.toJSON()
        });
    });

    // Ordena os eventos combinados pela data de início
    eventos.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    return eventos;
};

module.exports = {
    findAll,
    ativar,
    getVisaoGeral
};