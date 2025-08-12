// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento } = require('../../models');
const { parse, addDays } = require('date-fns');
const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

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
 * Processa um arquivo XLSX e popula/atualiza a tabela de funcionários.
 * @param {string} filePath - O caminho do arquivo .xlsx enviado.
 */
const importFromXLSX = async (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Ler o arquivo do caminho temporário
            const workbook = XLSX.readFile(filePath);

            // 2. Pegar o nome da primeira planilha
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // 3. Converter a planilha para um array de objetos JSON
            // raw: false garante que as datas sejam interpretadas corretamente
            const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });

            const funcionariosParaCriar = data.map(row => {
                const funcionario = {};
                for (const key in row) {
                    // Opcional: Remover espaços extras dos cabeçalhos, se necessário
                    const trimmedKey = key.trim(); 
                    if (columnMapping[trimmedKey]) {
                        let value = row[key];
                        // O leitor XLSX já pode converter datas, mas podemos garantir o formato
                        if (trimmedKey.startsWith('Dth.') && value) {
                            // A biblioteca lê datas no formato de data do Excel, que precisam ser convertidas
                            // Se a data já vier como string 'DD/MM/AAAA', o código abaixo funciona.
                            // Se vier como número serial do Excel, XLSX.SSF.parse_date_code(value) seria necessário.
                            // Vamos assumir que a conversão para string de data já ocorreu.
                            const parts = String(value).split('/');
                            if(parts.length === 3) {
                                value = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            } else {
                                value = new Date(value); // Tenta parsear a data diretamente
                            }
                        }
                        funcionario[columnMapping[trimmedKey]] = value || null;
                    }
                }
                return funcionario;
            }).filter(f => f.matricula); // Garante que apenas linhas com matrícula sejam processadas

            if (funcionariosParaCriar.length === 0) {
                fs.unlinkSync(filePath); // Limpa o arquivo temporário
                return reject(new Error("Nenhum registro válido encontrado na planilha. Verifique o cabeçalho das colunas."));
            }

            // 4. Usar 'bulkCreate' para inserir ou atualizar os registros no banco
            await Funcionario.bulkCreate(funcionariosParaCriar, {
                updateOnDuplicate: Object.values(columnMapping).filter(field => field !== 'matricula')
            });

            fs.unlinkSync(filePath); // Limpa o arquivo temporário
            resolve({ message: `${funcionariosParaCriar.length} registros processados com sucesso do arquivo XLSX.` });

        } catch (error) {
            fs.unlinkSync(filePath); // Garante a limpeza em caso de erro
            reject(error);
        }
    });
}

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