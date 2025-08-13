// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, sequelize } = require('../../models');
const feriasService = require('../ferias/ferias.service');
const fs = require('fs');
const XLSX = require('xlsx');
const { addYears, addMonths, addDays, differenceInDays, parse } = require('date-fns');

const columnMapping = {
    'Matrícula': 'matricula',
    'Nome Funcionário': 'nome_funcionario',
    'Dth. Admissão': 'dth_admissao',
    'Categoria_Trabalhador': 'categoria_trabalhador',
    'Municipio_Local_Trabalho': 'municipio_local_trabalho',
    'DiasAfastado': 'dias_afastado',
    'Razão Social Filial': 'razao_social_filial',
    'Código Filial': 'codigo_filial',
    'Categoria': 'categoria',
    'Contrato': 'contrato',
    'Local De Trabalho': 'local_de_trabalho',
    'Horário': 'horario',
    'Afastamento': 'afastamento',
    'Convenção': 'convencao',
};

/**
 * Processa um arquivo XLSX, LIMPA O BANCO DE DADOS (funcionários, férias, afastamentos)
 * e insere os novos dados aplicando as regras de negócio.
 */
const importFromXLSX = async (filePath) => {
    console.log(`[LOG FUNCIONARIO SERVICE] Iniciando processo de importação com RESET para o arquivo: ${filePath}`);
    const t = await sequelize.transaction();

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG FUNCIONARIO SERVICE] Planilha lida. ${data.length} linhas encontradas.`);

        const funcionariosParaProcessar = [];
        for (const row of data) {
            const funcionarioMapeado = {};
            for (const key in row) {
                const trimmedKey = key.trim();
                if (columnMapping[trimmedKey]) {
                    funcionarioMapeado[columnMapping[trimmedKey]] = row[key] || null;
                }
            }
            
            if (!funcionarioMapeado.matricula || !funcionarioMapeado.dth_admissao) continue;

            const admissao = parse(funcionarioMapeado.dth_admissao, 'dd/MM/yyyy', new Date());
            if (isNaN(admissao.getTime())) continue;
            funcionarioMapeado.dth_admissao = admissao;

            const hoje = new Date();
            const anosDeEmpresa = differenceInDays(hoje, admissao) / 365.25;
            let ultimoAniversario = addYears(admissao, Math.floor(anosDeEmpresa));
            if (ultimoAniversario > hoje) ultimoAniversario = addYears(ultimoAniversario, -1);
            
            const inicioPeriodo = ultimoAniversario;
            let fimPeriodo = addDays(addYears(inicioPeriodo, 1), -1);
            const diasAfastadoSuspensao = parseInt(funcionarioMapeado.dias_afastado, 10) || 0;
            if (diasAfastadoSuspensao > 0) fimPeriodo = addDays(fimPeriodo, diasAfastadoSuspensao);

            funcionarioMapeado.periodo_aquisitivo_atual_inicio = inicioPeriodo;
            funcionarioMapeado.periodo_aquisitivo_atual_fim = fimPeriodo;
            funcionarioMapeado.dth_limite_ferias = addMonths(fimPeriodo, 11);
            funcionarioMapeado.saldo_dias_ferias = 30;
            funcionarioMapeado.faltas_injustificadas_periodo = 0;
            funcionarioMapeado.status = 'Ativo';
            
            funcionariosParaProcessar.push(funcionarioMapeado);
        }

        if (funcionariosParaProcessar.length === 0) {
            throw new Error("Nenhum registro válido foi encontrado na planilha.");
        }
        
        console.log(`[LOG FUNCIONARIO SERVICE] Processamento de regras de negócio concluído.`);
        console.log('[LOG DB] Limpando dados antigos (Férias, Afastamentos, Funcionários)...');
        await Ferias.destroy({ where: {}, truncate: true, transaction: t });
        await Afastamento.destroy({ where: {}, truncate: true, transaction: t });
        await Funcionario.destroy({ where: {}, truncate: true, transaction: t });
        console.log('[LOG DB] Tabelas limpas com sucesso.');

        console.log(`[LOG DB] Inserindo ${funcionariosParaProcessar.length} novos registros de funcionários...`);
        await Funcionario.bulkCreate(funcionariosParaProcessar, { transaction: t });
        
        console.log('[LOG FUNCIONARIO SERVICE] Chamando o serviço para gerar o planejamento de férias inicial...');
        const anoAtual = new Date().getFullYear();
        await feriasService.distribuirFerias(
            anoAtual, 
            `Planejamento inicial gerado após importação em ${new Date().toLocaleDateString('pt-BR')}`, 
            t
        );
        console.log('[LOG FUNCIONARIO SERVICE] Planejamento inicial gerado com sucesso.');

        await t.commit();
        
        console.log(`[LOG FUNCIONARIO SERVICE] SUCESSO! Transação concluída.`);
        fs.unlinkSync(filePath);
        return { message: `Importação concluída! ${funcionariosParaProcessar.length} funcionários cadastrados e o planejamento de férias inicial foi gerado.` };

    } catch (err) {
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] A transação foi revertida. Nenhum dado foi alterado no banco.", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw new Error("Ocorreu um erro crítico durante a importação. O banco de dados foi restaurado ao estado anterior. Verifique os logs do servidor para mais detalhes.");
    }
};

/**
 * Busca todos os funcionários com filtros e paginação (SEM CACHE).
 */
const findAll = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (queryParams.busca) {
        whereClause[Op.or] = [
            { nome_funcionario: { [Op.iLike]: `%${queryParams.busca}%` } },
            { matricula: { [Op.iLike]: `%${queryParams.busca}%` } }
        ];
    }
    if (queryParams.status) { whereClause.status = queryParams.status; }
    if (queryParams.municipio) { whereClause.municipio_local_trabalho = queryParams.municipio; }
    if (queryParams.filtro) {
        const hoje = new Date();
        if (queryParams.filtro === 'vencidas') {
            whereClause.dth_limite_ferias = { [Op.lt]: hoje };
        }
        if (queryParams.filtro === 'risco_iminente') {
            const dataLimiteRisco = addDays(hoje, 30);
            whereClause.dth_limite_ferias = { [Op.between]: [hoje, dataLimiteRisco] };
        }
    }
    
    const { count, rows } = await Funcionario.findAndCountAll({
        where: whereClause,
        order: [['nome_funcionario', 'ASC']],
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
 * Cria um novo funcionário.
 */
const create = async (dadosFuncionario) => {
  return Funcionario.create(dadosFuncionario);
};

/**
 * Busca os detalhes de um único funcionário.
 */
const findOne = async (matricula) => {
  return Funcionario.findByPk(matricula, {
    include: [
      { model: Ferias, as: 'historicoFerias', order: [['data_inicio', 'DESC']] },
      { model: Afastamento, as: 'historicoAfastamentos', order: [['data_inicio', 'DESC']] }
    ]
  });
};

/**
 * Atualiza os dados de um funcionário.
 */
const update = async (matricula, dadosParaAtualizar) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  delete dadosParaAtualizar.matricula;
  await funcionario.update(dadosParaAtualizar);
  return funcionario;
};

/**
 * Remove um funcionário.
 */
const remove = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  await funcionario.destroy();
  return { message: 'Funcionário removido com sucesso.' };
};

/**
 * Exporta a lista de funcionários para XLSX.
 */
const exportAllToXLSX = async () => {
  const funcionarios = await Funcionario.findAll({ raw: true });
  const ws = XLSX.utils.json_to_sheet(funcionarios);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return { buffer, fileName: 'Relatorio_Completo_Funcionarios.xlsx' };
};

module.exports = {
  importFromXLSX,
  findAll,
  create,
  findOne,
  update,
  remove,
  exportAllToXLSX,
};