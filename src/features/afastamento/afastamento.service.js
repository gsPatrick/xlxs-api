// src/features/afastamento/afastamento.service.js

const { Afastamento, Funcionario } = require('../../models');
const { Op } = require('sequelize');
const feriasService = require('../ferias/ferias.service');

/**
 * ALTERADO: Busca todos os afastamentos ativos com filtros expandidos e paginação.
 * Agora, a filtragem pode ser feita por qualquer campo do funcionário.
 * @param {object} queryParams - Parâmetros da query para filtragem e paginação.
 * @returns {Promise<object>} Lista paginada de afastamentos.
 */
const findAllActive = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const whereFuncionario = {};
    // Busca rápida por nome ou matrícula
    if (queryParams.q) {
        whereFuncionario[Op.or] = [
            { nome_funcionario: { [Op.iLike]: `%${queryParams.q}%` } },
            { matricula: { [Op.iLike]: `%${queryParams.q}%` } }
        ];
    }
    
    // Filtros detalhados (copiados da lógica de funcionários)
    if (queryParams.status) { whereFuncionario.status = queryParams.status; }
    if (queryParams.matricula) { whereFuncionario.matricula = { [Op.iLike]: `%${queryParams.matricula}%` }; }
    if (queryParams.situacao_ferias_afastamento_hoje) { whereFuncionario.situacao_ferias_afastamento_hoje = { [Op.iLike]: `%${queryParams.situacao_ferias_afastamento_hoje}%` }; }
    if (queryParams.categoria) { whereFuncionario.categoria = { [Op.iLike]: `%${queryParams.categoria}%` }; }
    if (queryParams.categoria_trab) { whereFuncionario.categoria_trab = { [Op.iLike]: `%${queryParams.categoria_trab}%` }; }
    if (queryParams.horario) { whereFuncionario.horario = { [Op.iLike]: `%${queryParams.horario}%` }; }
    if (queryParams.escala) { whereFuncionario.escala = { [Op.iLike]: `%${queryParams.escala}%` }; }
    if (queryParams.sigla_local) { whereFuncionario.sigla_local = { [Op.iLike]: `%${queryParams.sigla_local}%` }; }
    if (queryParams.municipio_local_trabalho) { whereFuncionario.municipio_local_trabalho = { [Op.iLike]: `%${queryParams.municipio_local_trabalho}%` }; }
    if (queryParams.des_grupo_contrato) { whereFuncionario.des_grupo_contrato = { [Op.iLike]: `%${queryParams.des_grupo_contrato}%` }; }
    if (queryParams.id_grupo_contrato) { whereFuncionario.id_grupo_contrato = queryParams.id_grupo_contrato; }
    if (queryParams.convencao) { whereFuncionario.convencao = { [Op.iLike]: `%${queryParams.convencao}%` }; }
    
    const { count, rows } = await Afastamento.findAndCountAll({
        where: {
            // Filtra por afastamentos que ainda não terminaram ou não têm data de fim
            [Op.or]: [
                { data_fim: { [Op.is]: null } },
                { data_fim: { [Op.gte]: new Date() } }
            ]
        },
        include: [{
            model: Funcionario,
            where: whereFuncionario,
            required: true // Garante que só traga afastamentos de funcionários que batem com o filtro
        }],
        order: [['data_inicio', 'DESC']],
        limit,
        offset,
    });

    const totalPages = Math.ceil(count / limit);
    return {
        data: rows,
        pagination: { totalItems: count, totalPages, currentPage: page, limit }
    };
};


/**
 * Cria um novo registro de afastamento para um funcionário.
 * @param {object} dadosAfastamento - Dados do afastamento (motivo, datas, matricula_funcionario).
 * @returns {Promise<object>} O objeto do afastamento criado.
 */
const create = async (dadosAfastamento) => {
  const funcionario = await Funcionario.findByPk(dadosAfastamento.matricula_funcionario);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado para associar o afastamento.');
  }

  const novoAfastamento = await Afastamento.create(dadosAfastamento);
  await feriasService.recalcularPeriodoAquisitivo(dadosAfastamento.matricula_funcionario);
  return novoAfastamento;
};

/**
 * Busca um único registro de afastamento pelo seu ID.
 * @param {number} id - O ID do afastamento.
 * @returns {Promise<object|null>} O objeto do afastamento ou nulo se não encontrado.
 */
const findOne = async (id) => {
  return Afastamento.findByPk(id, { include: [Funcionario] });
};

/**
 * Atualiza um registro de afastamento.
 * @param {number} id - O ID do afastamento a ser atualizado.
 * @param {object} dadosParaAtualizar - Os novos dados para o afastamento.
 * @returns {Promise<object>} O objeto do afastamento atualizado.
 */
const update = async (id, dadosParaAtualizar) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  // Se a data_fim for enviada como string vazia ou nula, salve como null no banco
  if (dadosParaAtualizar.data_fim === '' || dadosParaAtualizar.data_fim === null) {
      dadosParaAtualizar.data_fim = null;
  }

  await afastamento.update(dadosParaAtualizar);
  await feriasService.recalcularPeriodoAquisitivo(afastamento.matricula_funcionario);
  return afastamento;
};

/**
 * Remove um registro de afastamento.
 * @param {number} id - O ID do afastamento a ser removido.
 * @returns {Promise<object>} Uma mensagem de sucesso.
 */
const remove = async (id) => {
  const afastamento = await Afastamento.findByPk(id);
  if (!afastamento) {
    throw new Error('Registro de afastamento não encontrado.');
  }

  const matricula = afastamento.matricula_funcionario;
  await afastamento.destroy();
  await feriasService.recalcularPeriodoAquisitivo(matricula);
  return { message: 'Afastamento removido com sucesso.' };
};

/**
 * NOVO: Remove múltiplos afastamentos em massa.
 * @param {Array<number>} ids - Array de IDs dos afastamentos a serem removidos.
 */
const bulkRemove = async (ids) => {
    if (!ids || ids.length === 0) {
        throw new Error("Nenhum ID fornecido para exclusão.");
    }

    const afastamentos = await Afastamento.findAll({ where: { id: { [Op.in]: ids } } });
    if (afastamentos.length === 0) {
        return { message: "Nenhum afastamento encontrado para os IDs fornecidos." };
    }

    const matriculas = [...new Set(afastamentos.map(af => af.matricula_funcionario))];

    await Afastamento.destroy({ where: { id: { [Op.in]: ids } } });

    // Recalcula o período para cada funcionário afetado
    for (const matricula of matriculas) {
        await feriasService.recalcularPeriodoAquisitivo(matricula);
    }

    return { message: `${ids.length} afastamentos removidos com sucesso.` };
};

module.exports = {
  findAllActive,
  create,
  findOne,
  update,
  remove,
  bulkRemove
};