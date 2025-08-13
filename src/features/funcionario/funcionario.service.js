// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, sequelize } = require('../../models');
const feriasService = require('../ferias/ferias.service');
const fs = require('fs');
const XLSX = require('xlsx');
const { addYears, addMonths, addDays, differenceInDays, parse } = require('date-fns');

const normalizeHeader = (header) => {
    if (!header) return '';
    return header.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[._]/g, '') // Remove pontos e underscores
        .replace(/\s+/g, ' '); // Normaliza múltiplos espaços para um só
};

// ==========================================================
// MAPEAMENTO CORRIGIDO COM CHAVES TOTALMENTE NORMALIZADAS
// ==========================================================
const columnMapping = {
    'matricula': 'matricula',
    'nome funcionario': 'nome_funcionario',
    'dth admissao': 'dth_admissao', // sem ponto
    'categoriatrabalhador': 'categoria_trabalhador', // sem underscore
    'municipiolocaltrabalho': 'municipio_local_trabalho', // sem underscore
    'diasafastado': 'dias_afastado',
    'dth ultima ferias': 'dth_ultima_ferias', // sem ponto
    'dth ultimo planejamento': 'dth_ultimo_planejamento', // sem ponto
    'dth limite ferias': 'dth_limite_ferias', // sem ponto
    'dth inicio periodo': 'dth_inicio_periodo', // sem ponto
    'dth final periodo': 'dth_final_periodo', // sem ponto
    'qtd dias ferias': 'qtd_dias_ferias', // sem ponto
    'razao social filial': 'razao_social_filial',
    'codigo filial': 'codigo_filial',
    'categoria': 'categoria',
    'contrato': 'contrato',
    'local de trabalho': 'local_de_trabalho',
    'horario': 'horario',
    'afastamento': 'afastamento',
    'convencao': 'convencao',
};


// Dentro do arquivo: src/features/funcionario/funcionario.service.js

const importFromXLSX = async (filePath) => {
    console.log(`[LOG FUNCIONARIO SERVICE] Iniciando processo de importação para: ${filePath}`);
    const t = await sequelize.transaction();

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG FUNCIONARIO SERVICE] Planilha lida. ${data.length} linhas de dados encontradas.`);
        
        const funcionariosParaProcessar = [];
        let linhasInvalidas = 0;

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

            const admissao = parse(String(funcionarioMapeado.dth_admissao), 'dd/MM/yyyy', new Date());
            if (isNaN(admissao.getTime())) {
                linhasInvalidas++;
                continue;
            }
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
        
        console.log(`[LOG FUNCIONARIO SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} registros válidos. ${linhasInvalidas} linhas inválidas puladas.`);

        if (funcionariosParaProcessar.length === 0) {
            throw new Error(`Nenhum registro válido foi encontrado. Verifique se as colunas estão nomeadas corretamente na planilha e se as datas de admissão estão no formato DD/MM/AAAA.`);
        }
        
        await Funcionario.destroy({
            where: {},
            truncate: true,
            cascade: true,
            transaction: t
        });
        
        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            transaction: t,
            updateOnDuplicate: Object.values(columnMapping).concat([
                'periodo_aquisitivo_atual_inicio',
                'periodo_aquisitivo_atual_fim',
                'dth_limite_ferias',
                'saldo_dias_ferias',
                'status',
                'faltas_injustificadas_periodo',
                'afastamento' // Garante que a coluna 'afastamento' seja atualizada se o funcionário já existir
            ]).filter(field => field !== 'matricula')
        });
        
        const anoAtual = new Date().getFullYear();
        await feriasService.distribuirFerias(anoAtual, `Planejamento inicial gerado após importação`, t);

        await t.commit();
        
        fs.unlinkSync(filePath);
        return { message: `Importação concluída! ${funcionariosParaProcessar.length} funcionários cadastrados. ${linhasInvalidas > 0 ? `${linhasInvalidas} linhas foram ignoradas.` : ''}` };

    } catch (err) {
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] A transação foi revertida.", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw new Error(err.message || "Ocorreu um erro crítico durante a importação.");
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