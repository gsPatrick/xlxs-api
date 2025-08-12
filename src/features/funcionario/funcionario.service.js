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
    console.log(`[LOG SERVICE] Iniciando processamento do arquivo: ${filePath}`);

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
            
            const admissaoStr = funcionarioMapeado.dth_admissao;
            const parts = String(admissaoStr).split('/');
            const admissao = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);

            if (isNaN(admissao.getTime())) {
                console.warn(`[AVISO SERVICE] Matrícula ${funcionarioMapeado.matricula}: Data de admissão inválida ('${admissaoStr}'). Pulando registro.`);
                continue;
            }

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
            
            console.log(`[LOG SERVICE] Processando Matrícula: ${funcionarioMapeado.matricula}. Limite Férias: ${format(funcionarioMapeado.dth_limite_ferias, 'dd/MM/yyyy')}`);
            funcionariosParaProcessar.push(funcionarioMapeado);
        }

        if (funcionariosParaProcessar.length === 0) {
            fs.unlinkSync(filePath);
            throw new Error("Nenhum registro válido com matrícula foi encontrado na planilha.");
        }
        
        console.log(`[LOG SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} funcionários serão inseridos/atualizados.`);

        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            updateOnDuplicate: Object.keys(columnMapping).map(k => columnMapping[k]).concat([
                'periodo_aquisitivo_atual_inicio', 'periodo_aquisitivo_atual_fim', 'dth_limite_ferias', 'saldo_dias_ferias'
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