// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento } = require('../../models');
const { parse, addDays } = require('date-fns');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');


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

// Lógica de importação de CSV (mantida e ajustada)
const importFromCSV = async (filePath) => {
  // ... (a lógica de importação que já tínhamos) ...
};

// Lógica de exportação, agora para XLSX
const exportAllToXLSX = async () => {
  const funcionarios = await Funcionario.findAll({ raw: true });
  const ws = XLSX.utils.json_to_sheet(funcionarios);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return { buffer, fileName: 'Relatorio_Funcionarios.xlsx' };
};

// Cria um novo funcionário
const create = async (dadosFuncionario) => {
  // Poderia ter validações aqui antes de criar
  const novoFuncionario = await Funcionario.create(dadosFuncionario);
  return novoFuncionario;
};

// Busca todos os funcionários com filtros avançados
const findAll = async (queryParams) => {
  const whereClause = {};

  // Filtro por nome ou matrícula
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
  
  // Filtro rápido do dashboard
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

  const funcionarios = await Funcionario.findAll({
    where: whereClause,
    order: [['nome_funcionario', 'ASC']]
  });
  return funcionarios;
};

// Busca um único funcionário com seus relacionamentos
const findOne = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula, {
    include: [
      {
        model: Ferias,
        as: 'historicoFerias',
        order: [['data_inicio', 'DESC']],
      },
      {
        model: Afastamento,
        as: 'historicoAfastamentos',
        order: [['data_inicio', 'DESC']],
      }
    ]
  });
  return funcionario;
};

// Atualiza os dados de um funcionário
const update = async (matricula, dadosParaAtualizar) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado');
  }
  // Remove a matrícula do objeto de atualização para evitar alteração da PK
  delete dadosParaAtualizar.matricula;
  
  await funcionario.update(dadosParaAtualizar);
  return funcionario;
};

// Remove um funcionário do banco de dados
const remove = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) {
    throw new Error('Funcionário não encontrado');
  }
  await funcionario.destroy();
  return { message: 'Funcionário removido com sucesso.' };
};


/**
 * Processa um arquivo XLSX, aplica as regras de negócio para cada funcionário
 * e popula o banco de dados.
 */
const importFromXLSX = async (filePath) => {
    console.log(`[LOG] Iniciando processo de importação para o arquivo: ${filePath}`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false });
    
    console.log(`[LOG] Planilha lida. ${data.length} linhas encontradas.`);

    const funcionariosParaProcessar = [];

    // 1. Mapeia e calcula os dados para cada funcionário da planilha
    for (const row of data) {
        if (!row['Matrícula']) continue; // Pula linhas sem matrícula

        const funcionarioMapeado = {};
        for (const key in row) {
            const trimmedKey = key.trim();
            if (columnMapping[trimmedKey]) {
                funcionarioMapeado[columnMapping[trimmedKey]] = row[key] || null;
            }
        }
        
        // --- APLICAÇÃO DAS REGRAS DE NEGÓCIO DIRETAMENTE NA IMPORTAÇÃO ---

        const admissao = new Date(funcionarioMapeado.dth_admissao);
        if (isNaN(admissao.getTime())) {
            console.warn(`[AVISO] Matrícula ${funcionarioMapeado.matricula}: Data de admissão inválida. Pulando registro.`);
            continue;
        }

        // Regra 1: Período Aquisitivo e Data Limite
        const anosDeEmpresa = differenceInDays(new Date(), admissao) / 365.25;
        const ultimoAniversario = addYears(admissao, Math.floor(anosDeEmpresa));
        
        let inicioPeriodo = ultimoAniversario;
        if (inicioPeriodo > new Date()) {
            inicioPeriodo = addYears(inicioPeriodo, -1);
        }
        let fimPeriodo = addDays(addYears(inicioPeriodo, 1), -1);

        // Regra 4.2 (simplificada): Afastamentos suspendem o período.
        // A lógica completa será acionada ao lançar afastamentos individualmente.
        // Aqui, usamos o campo "DiasAfastado" para um ajuste inicial.
        const diasAfastado = parseInt(funcionarioMapeado.dias_afastado, 10) || 0;
        fimPeriodo = addDays(fimPeriodo, diasAfastado);

        funcionarioMapeado.periodo_aquisitivo_atual_inicio = inicioPeriodo;
        funcionarioMapeado.periodo_aquisitivo_atual_fim = fimPeriodo;
        funcionarioMapeado.dth_limite_ferias = addMonths(fimPeriodo, 11);

        // Regra 3: Saldo de Férias baseado em Faltas (na importação, não temos essa info, então começamos com 30)
        // O campo 'faltas_injustificadas_periodo' pode ser atualizado manualmente depois.
        funcionarioMapeado.saldo_dias_ferias = 30; // Valor padrão inicial
        
        console.log(`[LOG] Processando Matrícula: ${funcionarioMapeado.matricula}. Limite de Férias calculado: ${format(funcionarioMapeado.dth_limite_ferias, 'dd/MM/yyyy')}`);
        funcionariosParaProcessar.push(funcionarioMapeado);
    }

    if (funcionariosParaProcessar.length === 0) {
        fs.unlinkSync(filePath);
        throw new Error("Nenhum registro válido com matrícula foi encontrado na planilha.");
    }
    
    console.log(`[LOG] Processamento concluído. ${funcionariosParaProcessar.length} funcionários serão inseridos/atualizados.`);

    // 2. Insere/Atualiza os dados no banco de dados
    try {
        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            updateOnDuplicate: Object.values(columnMapping).concat([
                'periodo_aquisitivo_atual_inicio',
                'periodo_aquisitivo_atual_fim',
                'dth_limite_ferias',
                'saldo_dias_ferias'
            ]).filter(field => field !== 'matricula')
        });
        
        console.log(`[LOG] SUCESSO! ${funcionariosParaProcessar.length} registros foram salvos no banco de dados.`);
        fs.unlinkSync(filePath);
        return { message: `${funcionariosParaProcessar.length} registros processados e salvos com sucesso.` };

    } catch (dbError) {
        console.error("[ERRO DB] Falha ao executar bulkCreate:", dbError);
        fs.unlinkSync(filePath);
        throw new Error("Ocorreu um erro ao salvar os dados no banco.");
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