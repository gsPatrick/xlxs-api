// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, sequelize } = require('../../models'); // Adicionar sequelize para transações
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
    console.log(`[LOG SERVICE] Iniciando processo de importação com RESET para o arquivo: ${filePath}`);
    
    // Inicia uma transação gerenciada pelo Sequelize
    const t = await sequelize.transaction();

    try {
        // --- ETAPA 1: LER E PROCESSAR A PLANILHA ---
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG SERVICE] Planilha lida. ${data.length} linhas encontradas.`);

        const funcionariosParaProcessar = [];
        for (const [index, row] of data.entries()) {
            const funcionarioMapeado = {};
            for (const key in row) {
                const trimmedKey = key.trim();
                if (columnMapping[trimmedKey]) {
                    funcionarioMapeado[columnMapping[trimmedKey]] = row[key] || null;
                }
            }
            
            if (!funcionarioMapeado.matricula || !funcionarioMapeado.dth_admissao) {
                console.warn(`[AVISO SERVICE] Linha ${index + 2}: Matrícula ou Admissão ausentes. Pulando.`);
                continue;
            }

            const admissao = parse(funcionarioMapeado.dth_admissao, 'dd/MM/yyyy', new Date());
            if (isNaN(admissao.getTime())) {
                console.warn(`[AVISO SERVICE] Matrícula ${funcionarioMapeado.matricula}: Data de admissão inválida. Pulando.`);
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

        if (funcionariosParaProcessar.length === 0) {
            throw new Error("Nenhum registro válido foi encontrado na planilha.");
        }
        
        console.log(`[LOG SERVICE] Processamento de regras de negócio concluído. ${funcionariosParaProcessar.length} funcionários prontos para inserção.`);

        // --- ETAPA 2: LIMPAR DADOS ANTIGOS (DENTRO DA TRANSAÇÃO) ---
        console.log('[LOG DB] Limpando dados antigos (Férias, Afastamentos, Funcionários)...');
        // A ordem é importante devido às restrições de chave estrangeira
        await Ferias.destroy({ where: {}, truncate: true, transaction: t });
        await Afastamento.destroy({ where: {}, truncate: true, transaction: t });
        await Funcionario.destroy({ where: {}, truncate: true, transaction: t });
        console.log('[LOG DB] Tabelas limpas com sucesso.');

        // --- ETAPA 3: INSERIR NOVOS DADOS (DENTRO DA TRANSAÇÃO) ---
        console.log(`[LOG DB] Inserindo ${funcionariosParaProcessar.length} novos registros de funcionários...`);
        await Funcionario.bulkCreate(funcionariosParaProcessar, { transaction: t });
        
        // --- ETAPA 4: COMMIT DA TRANSAÇÃO ---
        await t.commit();
        
        console.log(`[LOG SERVICE] SUCESSO! Transação concluída. ${funcionariosParaProcessar.length} registros foram salvos.`);
        
        fs.unlinkSync(filePath); // Limpa o arquivo temporário
        return { message: `Importação concluída com sucesso! ${funcionariosParaProcessar.length} funcionários foram cadastrados e os dados antigos foram substituídos.` };

    } catch (err) {
        // --- ETAPA 5: ROLLBACK EM CASO DE ERRO ---
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] A transação foi revertida. Nenhum dado foi alterado.", err);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error("Ocorreu um erro crítico durante a importação. O banco de dados foi restaurado ao estado anterior. Verifique os logs.");
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
 * NOTA: Esta função exporta TODOS os funcionários, sem filtros.
 * A exportação com filtros é feita pelo `relatorios.service.js`.
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
  exportAllToXLSX,
  create,
  findAll,
  findOne,
  update,
  remove,
  importFromXLSX
};