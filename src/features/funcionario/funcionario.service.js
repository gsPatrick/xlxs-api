// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, sequelize } = require('../../models');
const feriasService = require('../ferias/ferias.service');
const fs = require('fs');
const XLSX = require('xlsx');
const { parse, addDays } = require('date-fns'); // Adicionar 'addDays' para os filtros de risco

const normalizeHeader = (header) => {
    if (!header) return '';
    return header.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[._]/g, '') // Remove pontos e underscores
        .replace(/\s+/g, ''); // Remove TODOS os espaços para um match mais robusto
};

const columnMapping = {
    'matricula': 'matricula',
    'nomefuncionario': 'nome_funcionario',
    'dthadmissao': 'dth_admissao',
    'proximoperiodoaquisitivoinicio': 'periodo_aquisitivo_atual_inicio',
    'proximoperiodoaquisitivofinal': 'periodo_aquisitivo_atual_fim',
    'datalimite': 'dth_limite_ferias',
    'categoria': 'categoria',
    'categoriatrab': 'categoria_trab',
    'horario': 'horario',
    'escala': 'escala',
    'siglalocal': 'sigla_local',
    'desgrupocontrato': 'des_grupo_contrato',
    'idgrupocontrato': 'id_grupo_contrato',
    'convencao': 'convencao',
    'situacaoferiasafastamentohoje': 'situacao_ferias_afastamento_hoje',
    'qtdfaltas': 'faltas_injustificadas_periodo'
};

const importFromXLSX = async (filePath) => {
    console.log(`[LOG FUNCIONARIO SERVICE] Iniciando processo de importação para: ${filePath}`);
    const t = await sequelize.transaction();

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG FUNCIONARIO SERVICE] Planilha lida. ${data.length} linhas de dados encontradas.`);
        
        const funcionariosParaProcessar = [];
        let linhasInvalidas = 0;
        const matriculasDaPlanilha = new Set();

        for (const row of data) {
            const funcionarioMapeado = {};
            for (const key in row) {
                const normalizedKey = normalizeHeader(key);
                if (columnMapping[normalizedKey]) {
                    funcionarioMapeado[columnMapping[normalizedKey]] = row[key] || null;
                }
            }
            
            if (!funcionarioMapeado.matricula || !funcionarioMapeado.dth_admissao) {
                linhasInvalidas++;
                continue;
            }

            const datasParaConverter = ['dth_admissao', 'periodo_aquisitivo_atual_inicio', 'periodo_aquisitivo_atual_fim', 'dth_limite_ferias'];
            let dataInvalida = false;
            for(const campoData of datasParaConverter) {
                if (funcionarioMapeado[campoData]) {
                    const dataObj = parse(String(funcionarioMapeado[campoData]), 'dd/MM/yyyy', new Date());
                    if (isNaN(dataObj.getTime())) {
                        dataInvalida = true;
                        break;
                    }
                    funcionarioMapeado[campoData] = dataObj;
                }
            }
            if(dataInvalida) {
                linhasInvalidas++;
                continue;
            }
            
            const faltas = parseInt(funcionarioMapeado.faltas_injustificadas_periodo, 10) || 0;
            if (faltas <= 5) funcionarioMapeado.saldo_dias_ferias = 30;
            else if (faltas >= 6 && faltas <= 14) funcionarioMapeado.saldo_dias_ferias = 24;
            else if (faltas >= 15 && faltas <= 23) funcionarioMapeado.saldo_dias_ferias = 18;
            else if (faltas >= 24 && faltas <= 32) funcionarioMapeado.saldo_dias_ferias = 12;
            else funcionarioMapeado.saldo_dias_ferias = 0;

            funcionarioMapeado.status = 'Ativo';
            
            funcionariosParaProcessar.push(funcionarioMapeado);
            matriculasDaPlanilha.add(funcionarioMapeado.matricula);
        }
        
        console.log(`[LOG FUNCIONARIO SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} registros válidos. ${linhasInvalidas} linhas inválidas puladas.`);

        if (funcionariosParaProcessar.length === 0) {
            throw new Error(`Nenhum registro válido foi encontrado. Verifique a planilha.`);
        }
        
        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            transaction: t,
            updateOnDuplicate: Object.values(columnMapping).concat([
                'saldo_dias_ferias',
                'status'
            ]).filter(field => field !== 'matricula')
        });
        
        console.log(`[LOG FUNCIONARIO SERVICE] ${funcionariosParaProcessar.length} funcionários criados ou atualizados.`);
        
        const funcionariosNoBanco = await Funcionario.findAll({ attributes: ['matricula'], where: { status: 'Ativo' }, transaction: t, raw: true });
        const matriculasParaDesativar = funcionariosNoBanco
            .map(f => f.matricula)
            .filter(m => !matriculasDaPlanilha.has(m));
            
        let desativados = 0;
        if(matriculasParaDesativar.length > 0) {
            const [updateCount] = await Funcionario.update(
                { status: 'Inativo' },
                { where: { matricula: { [Op.in]: matriculasParaDesativar } }, transaction: t }
            );
            desativados = updateCount;
            console.log(`[LOG FUNCIONARIO SERVICE] ${desativados} funcionários foram desativados por não estarem na planilha.`);
        }

        await t.commit();
        
        fs.unlinkSync(filePath);
        return { 
            message: `Importação concluída! ${funcionariosParaProcessar.length} funcionários processados (criados/atualizados). ${desativados} funcionários foram marcados como inativos. ${linhasInvalidas > 0 ? `${linhasInvalidas} linhas foram ignoradas.` : ''}` 
        };

    } catch (err) {
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] A transação foi revertida.", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw new Error(err.message || "Ocorreu um erro crítico durante a importação.");
    }
};

// ==========================================================
// ALTERADO: Função `findAll` expandida com novos filtros
// ==========================================================
/**
 * Busca todos os funcionários com filtros e paginação.
 */
const findAll = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Filtro de busca genérico
    if (queryParams.busca) {
        whereClause[Op.or] = [
            { nome_funcionario: { [Op.iLike]: `%${queryParams.busca}%` } },
            { matricula: { [Op.iLike]: `%${queryParams.busca}%` } }
        ];
    }

    // Filtro por status
    if (queryParams.status) { 
        whereClause.status = queryParams.status; 
    }
    
    // NOVO: Filtros específicos solicitados no PDF
    if (queryParams.municipio) { 
        whereClause.municipio_local_trabalho = queryParams.municipio; 
    }
    if (queryParams.grupoContrato) {
        whereClause.des_grupo_contrato = queryParams.grupoContrato;
    }
    if (queryParams.categoria) {
        whereClause.categoria = queryParams.categoria;
    }
    if (queryParams.tipoContrato) { // Corresponde a "Categoria do Trabalhador"
        whereClause.categoria_trab = queryParams.tipoContrato;
    }

    // Filtros de Risco (existentes)
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