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
    const mes = queryParams.mes ? parseInt(queryParams.mes, 10) : null;

    if (!ano) {
        throw new Error("O ano é obrigatório.");
    }

    // Define o intervalo de busca: ou um mês específico, ou o ano inteiro
    const inicioBusca = mes ? startOfMonth(new Date(ano, mes - 1)) : startOfYear(new Date(ano, 0, 1));
    const fimBusca = mes ? endOfMonth(new Date(ano, mes - 1)) : endOfYear(new Date(ano, 11, 31));

    const whereFuncionario = {};
    if (queryParams.grupoContrato) { whereFuncionario.des_grupo_contrato = { [Op.iLike]: `%${queryParams.grupoContrato}%` }; }
    if (queryParams.municipio) { whereFuncionario.municipio_local_trabalho = { [Op.iLike]: `%${queryParams.municipio}%` }; }
    if (queryParams.categoria) { whereFuncionario.categoria = { [Op.iLike]: `%${queryParams.categoria}%` }; }
    if (queryParams.tipoContrato) { whereFuncionario.categoria_trab = { [Op.iLike]: `%${queryParams.tipoContrato}%` }; }
    if (queryParams.estado) { whereFuncionario.sigla_local = { [Op.iLike]: `%${queryParams.estado}%` }; }
    if (queryParams.cliente) { whereFuncionario.cliente = { [Op.iLike]: `%${queryParams.cliente}%` }; }
    if (queryParams.contrato) { whereFuncionario.contrato = { [Op.iLike]: `%${queryParams.contrato}%` }; }

    // Condição para encontrar qualquer evento que se sobreponha ao período de busca
    const whereEventos = {
        [Op.or]: [
            { data_inicio: { [Op.between]: [inicioBusca, fimBusca] } },
            { data_fim: { [Op.between]: [inicioBusca, fimBusca] } },
            { [Op.and]: [ { data_inicio: { [Op.lte]: fimBusca } }, { data_fim: { [Op.gte]: inicioBusca } } ]}
        ]
    };

    const feriasNoPeriodo = await Ferias.findAll({
        where: whereEventos,
        include: [{ 
            model: Funcionario, 
            attributes: ['nome_funcionario', 'matricula'],
            where: whereFuncionario,
            required: true
        }]
    });

    const afastamentosNoPeriodo = await Afastamento.findAll({
        where: whereEventos,
        include: [{ 
            model: Funcionario, 
            attributes: ['nome_funcionario', 'matricula'],
            where: whereFuncionario,
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
            funcionario: f.Funcionario.nome_funcionario,
            matricula: f.Funcionario.matricula
        });
    });

    afastamentosNoPeriodo.forEach(a => {
        eventos.push({
            id: `afastamento-${a.id}`,
            tipo: 'Afastamento',
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            status: a.motivo,
            funcionario: a.Funcionario.nome_funcionario,
            matricula: a.Funcionario.matricula
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