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


const importFromXLSX = async (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // --- AQUI ESTÁ A CORREÇÃO ---
            // A opção 'range: 1' instrui a biblioteca a ignorar a primeira linha (índice 0)
            // e começar a ler a partir da segunda linha (índice 1), que contém seus cabeçalhos.
            const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false });
            
            // O resto da lógica permanece o mesmo
            const funcionariosParaCriar = data.map(row => {
                const funcionario = {};
                for (const key in row) {
                    const trimmedKey = key.trim(); 
                    if (columnMapping[trimmedKey]) {
                        let value = row[key];
                        if (trimmedKey.startsWith('Dth.') && value) {
                            // Tenta converter a data, robusto para diferentes formatos
                            const parts = String(value).split('/');
                            if(parts.length === 3) {
                                // Formato DD/MM/AAAA
                                value = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            } else {
                                // Tenta um parse genérico
                                const parsedDate = new Date(value);
                                if (!isNaN(parsedDate)) {
                                    value = parsedDate;
                                } else {
                                    value = null; // Data inválida
                                }
                            }
                        }
                        funcionario[columnMapping[trimmedKey]] = value || null;
                    }
                }
                return funcionario;
            }).filter(f => f.matricula);

            if (funcionariosParaCriar.length === 0) {
                fs.unlinkSync(filePath);
                return reject(new Error("Nenhum registro válido encontrado. Verifique se os nomes das colunas na linha 2 da planilha correspondem ao padrão."));
            }

            await Funcionario.bulkCreate(funcionariosParaCriar, {
                updateOnDuplicate: Object.values(columnMapping).filter(field => field !== 'matricula')
            });

            fs.unlinkSync(filePath);
            resolve({ message: `${funcionariosParaCriar.length} registros processados com sucesso do arquivo XLSX.` });

        } catch (error) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            console.error("Erro detalhado no serviço de importação:", error);
            reject(new Error("Ocorreu um erro interno ao processar a planilha."));
        }
    });
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