// src/features/funcionario/funcionario.service.js

const { Funcionario } = require('../../models');
const fs = require('fs');
const XLSX = require('xlsx');
const { addYears, addMonths, addDays, differenceInDays } = require('date-fns');
const { format } = require('date-fns-tz'); // Usar date-fns-tz para lidar com fusos horários

const columnMapping = {
    'Matrícula': 'matricula',
    'Nome Funcionário': 'nome_funcionario',
    'Dth. Admissão': 'dth_admissao',
    'Categoria_Trabalhador': 'categoria_trabalhador',
    'Municipio_Local_Trabalho': 'municipio_local_trabalho',
    'DiasAfastado': 'dias_afastado',
    'Dth. Última Férias': 'dth_ultima_ferias',
    'Dth. Último Planejamento': 'dth_ultimo_planejamento',
    'Dth. Limite Férias': 'dth_limite_ferias',
    'Dth. Início Período': 'dth_inicio_periodo',
    'Dth. Final Período': 'dth_final_periodo',
    'Qtd. Dias Férias': 'qtd_dias_ferias',
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
 * Cria um novo funcionário.
 */
const create = async (dadosFuncionario) => {
  const novoFuncionario = await Funcionario.create(dadosFuncionario);
  cache.clear(); // Invalida todo o cache de funcionários
  return novoFuncionario;
};

/**
 * Busca todos os funcionários com filtros avançados, paginação e cache.
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

    const cacheKey = `funcionarios:page=${page}:limit=${limit}:${JSON.stringify(whereClause)}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`[LOG CACHE] HIT: Retornando dados do cache para a chave: ${cacheKey}`);
        return cachedData;
    }
    
    console.log(`[LOG CACHE] MISS: Buscando dados do banco para a chave: ${cacheKey}`);
    
    const { count, rows } = await Funcionario.findAndCountAll({
        where: whereClause,
        order: [['nome_funcionario', 'ASC']],
        limit,
        offset,
    });

    const totalPages = Math.ceil(count / limit);

    const result = {
        data: rows,
        pagination: { totalItems: count, totalPages, currentPage: page, limit }
    };

    cache.set(cacheKey, result, 300000); // Cache por 5 minutos

    return result;
};

/**
 * Busca os detalhes de um único funcionário.
 */
const findOne = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula, {
    include: [
      { model: Ferias, as: 'historicoFerias', order: [['data_inicio', 'DESC']] },
      { model: Afastamento, as: 'historicoAfastamentos', order: [['data_inicio', 'DESC']] }
    ]
  });
  return funcionario;
};

/**
 * Atualiza os dados de um funcionário.
 */
const update = async (matricula, dadosParaAtualizar) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  delete dadosParaAtualizar.matricula;
  await funcionario.update(dadosParaAtualizar);
  cache.clear(); // Invalida o cache
  return funcionario;
};

/**
 * Remove um funcionário.
 */
const remove = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  await funcionario.destroy();
  cache.clear(); // Invalida o cache
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

/**
 * Processa um arquivo XLSX, aplica as regras de negócio para cada funcionário
 * e popula o banco de dados.
 */
const importFromXLSX = async (filePath) => {
    console.log(`[LOG SERVICE] Iniciando processo de importação para o arquivo: ${filePath}`);

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        console.log(`[LOG SERVICE] Lendo planilha: '${sheetName}'`);

        const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false, dateNF: 'dd/mm/yyyy' });
        
        console.log(`[LOG SERVICE] Planilha convertida para JSON. ${data.length} linhas de dados encontradas.`);

        const funcionariosParaProcessar = [];

        for (const [index, row] of data.entries()) {
            if (!row['Matrícula']) {
                console.warn(`[AVISO SERVICE] Linha ${index + 2}: Matrícula não encontrada. Pulando linha.`);
                continue;
            }

            const funcionarioMapeado = {};
            for (const key in row) {
                const trimmedKey = key.trim();
                if (columnMapping[trimmedKey]) {
                    funcionarioMapeado[columnMapping[trimmedKey]] = row[key] || null;
                }
            }
            
            // --- CORREÇÃO E VALIDAÇÃO ROBUSTA DE DATA ---
            const admissaoStr = funcionarioMapeado.dth_admissao;
            if (!admissaoStr) {
                console.warn(`[AVISO SERVICE] Matrícula ${funcionarioMapeado.matricula}: Data de admissão em branco. Pulando registro.`);
                continue; // Pula este funcionário se a data de admissão for crucial e estiver faltando
            }

            let admissao;
            const parts = String(admissaoStr).split('/');
            if (parts.length === 3) {
                // Tenta construir a data no formato AAAA-MM-DD para evitar ambiguidades de fuso horário
                admissao = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
            } else {
                admissao = new Date(admissaoStr); // Fallback para outros formatos
            }

            // A VALIDAÇÃO MAIS IMPORTANTE:
            if (isNaN(admissao.getTime())) {
                console.warn(`[AVISO SERVICE] Matrícula ${funcionarioMapeado.matricula}: Data de admissão inválida ('${admissaoStr}'). O funcionário será pulado.`);
                continue; // Pula o registro se a data for inválida
            }
            
            // Atribui a data válida ao objeto
            funcionarioMapeado.dth_admissao = admissao;

            const hoje = new Date();
            const anosDeEmpresa = differenceInDays(hoje, admissao) / 365.25;
            const ultimoAniversario = addYears(admissao, Math.floor(anosDeEmpresa));
            
            let inicioPeriodo = ultimoAniversario;
            if (inicioPeriodo > hoje) {
                inicioPeriodo = addYears(inicioPeriodo, -1);
            }
            let fimPeriodo = addDays(addYears(inicioPeriodo, 1), -1);

            const diasAfastado = parseInt(funcionarioMapeado.dias_afastado, 10) || 0;
            fimPeriodo = addDays(fimPeriodo, diasAfastado);

            funcionarioMapeado.periodo_aquisitivo_atual_inicio = inicioPeriodo;
            funcionarioMapeado.periodo_aquisitivo_atual_fim = fimPeriodo;
            funcionarioMapeado.dth_limite_ferias = addMonths(fimPeriodo, 11);
            funcionarioMapeado.saldo_dias_ferias = 30;
            
            // Opcional: log apenas para os primeiros 10 para não poluir o terminal
            if (index < 10) {
                console.log(`[LOG SERVICE] Processando Matrícula: ${funcionarioMapeado.matricula}. Limite Férias: ${format(funcionarioMapeado.dth_limite_ferias, 'dd/MM/yyyy')}`);
            }
            
            funcionariosParaProcessar.push(funcionarioMapeado);
        }

        if (funcionariosParaProcessar.length === 0) {
            fs.unlinkSync(filePath);
            throw new Error("Nenhum registro válido com matrícula e data de admissão válidas foi encontrado na planilha.");
        }
        
        console.log(`[LOG SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} funcionários serão inseridos/atualizados.`);

        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            updateOnDuplicate: Object.values(columnMapping).concat([
                'periodo_aquisitivo_atual_inicio',
                'periodo_aquisitivo_atual_fim',
                'dth_limite_ferias',
                'saldo_dias_ferias'
            ]).filter(field => field !== 'matricula')
        });
        
        console.log(`[LOG SERVICE] SUCESSO! ${funcionariosParaProcessar.length} registros foram salvos no banco de dados.`);
        fs.unlinkSync(filePath);
        return { message: `${funcionariosParaProcessar.length} registros processados e salvos com sucesso.` };

    } catch (err) {
        console.error("[ERRO FATAL SERVICE] Falha na importação:", err);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error("Ocorreu um erro interno ao processar a planilha. Verifique os logs do servidor.");
    }
};

module.exports = {
  importFromCSV,
  exportAllToXLSX,
  create,
  findAll,
  findOne,
  update,
  remove,
  importFromXLSX
};