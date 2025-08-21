// src/features/funcionario/funcionario.service.js

const { Op } = require('sequelize');
const { Funcionario, Ferias, Afastamento, sequelize } = require('../../models');
const feriasService = require('../ferias/ferias.service');
const fs = require('fs');
const XLSX = require('xlsx');
const { parse, addDays } = require('date-fns');

const normalizeHeader = (header) => {
    if (!header) return '';
    return header.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[._]/g, '') // Remove pontos e underscores
        .replace(/\s+/g, ''); // Remove TODOS os espaços
};

const columnMapping = {
    'matricula': 'matricula',
    'nomefuncionario': 'nome_funcionario',
    'dthadmissao': 'dth_admissao',
    'proximoperiodoaquisitivo': 'proximo_periodo_aquisitivo_texto', // Novo
    'proximoperiodoaquisitivoinicio': 'periodo_aquisitivo_atual_inicio',
    'proximoperiodoaquisitivofinal': 'periodo_aquisitivo_atual_fim',
    'datalimite': 'dth_limite_ferias',
    'datalimitefiltro': 'data_limite_filtro', // Novo
    'ultimadataplanejada': 'ultima_data_planejada', // Novo
    'ultimadataplanejadames': 'ultima_data_planejada_mes', // Novo
    'anoultimadataplanejada': 'ano_ultima_data_planejada', // Novo
    'qtdperiodosplanejados': 'qtd_periodos_planejados', // Novo
    'qtdperiodosgozo': 'qtd_periodos_gozo', // Novo
    'qtdperiodospendentes': 'qtd_periodos_pendentes', // Novo
    'qtdperiodoscompletos': 'qtd_periodos_completos', // Novo
    'qtdperiodosincompletos': 'qtd_periodos_incompletos', // Novo
    'qtdperiodosindividuais': 'qtd_periodos_individuais', // Novo
    'qtdperiodoscoletivos': 'qtd_periodos_coletivos', // Novo
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
        
        const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG FUNCIONARIO SERVICE] Planilha lida. ${data.length} linhas de dados encontradas.`);
        
        const funcionariosParaProcessar = [];
        const afastamentosParaCriar = []; // Array para armazenar afastamentos
        let linhasInvalidas = 0;
        const matriculasDaPlanilha = new Set();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const linhaNumero = i + 2;

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
                    const dataString = String(funcionarioMapeado[campoData]);
                    const dataObj = parse(dataString, 'dd/MM/yyyy', new Date());
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

            const situacao = funcionarioMapeado.situacao_ferias_afastamento_hoje;
            if (situacao && situacao.toLowerCase().includes('afastamento de:')) {
                const regex = /(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/;
                const match = situacao.match(regex);
                if (match && match[1] && match[2]) {
                    const dataInicio = parse(match[1], 'dd/MM/yyyy', new Date());
                    const dataFim = parse(match[2], 'dd/MM/yyyy', new Date());
                    if (!isNaN(dataInicio.getTime()) && !isNaN(dataFim.getTime())) {
                        afastamentosParaCriar.push({
                            matricula_funcionario: funcionarioMapeado.matricula,
                            motivo: 'Afastamento importado da planilha',
                            data_inicio: dataInicio,
                            data_fim: dataFim,
                            impacta_ferias: true
                        });
                    }
                }
            }

            funcionarioMapeado.status = 'Ativo';
            funcionariosParaProcessar.push(funcionarioMapeado);
            matriculasDaPlanilha.add(String(funcionarioMapeado.matricula));
        }
        
        console.log(`[LOG FUNCIONARIO SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} registros válidos. ${afastamentosParaCriar.length} afastamentos identificados.`);

        if (funcionariosParaProcessar.length === 0) {
            throw new Error(`Nenhum registro válido foi encontrado.`);
        }
        
        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            transaction: t,
            updateOnDuplicate: Object.values(columnMapping).concat(['saldo_dias_ferias', 'status']).filter(field => field !== 'matricula')
        });
        
        if (afastamentosParaCriar.length > 0) {
            await Afastamento.bulkCreate(afastamentosParaCriar, {
                transaction: t,
                updateOnDuplicate: ['data_fim', 'motivo', 'impacta_ferias'],
            });
            console.log(`[LOG FUNCIONARIO SERVICE] ${afastamentosParaCriar.length} afastamentos criados ou atualizados.`);
        }

        const funcionariosNoBanco = await Funcionario.findAll({ attributes: ['matricula'], where: { status: 'Ativo' }, transaction: t, raw: true });
        const matriculasParaDesativar = funcionariosNoBanco
            .map(f => String(f.matricula))
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
        
        const anoAtual = new Date().getFullYear();
        await feriasService.distribuirFerias(anoAtual, `Planejamento gerado após importação`, t);

        await t.commit();
        
        fs.unlinkSync(filePath);
        return { 
            message: `Importação concluída! ${funcionariosParaProcessar.length} funcionários processados. ${afastamentosParaCriar.length} afastamentos registrados. Um novo planejamento de férias foi gerado.` 
        };

    } catch (err) {
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] A transação foi revertida.", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw new Error(err.message || "Ocorreu um erro crítico durante a importação.");
    }
};

const findAll = async (queryParams) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const whereClause = {};
    
if (queryParams.q) {
    whereClause[Op.or] = [
        { nome_funcionario: { [Op.iLike]: `%${queryParams.q}%` } },
        { matricula: { [Op.iLike]: `%${queryParams.q}%` } },
        { des_grupo_contrato: { [Op.iLike]: `%${queryParams.q}%` } }, // Gestão
        { cliente: { [Op.iLike]: `%${queryParams.q}%` } }, // Cliente
    ];
}
    
    if (queryParams.status) { whereClause.status = queryParams.status; }
    if (queryParams.municipio) { whereClause.municipio_local_trabalho = queryParams.municipio; }
    if (queryParams.grupoContrato) { whereClause.des_grupo_contrato = queryParams.grupoContrato; }
    if (queryParams.categoria) { whereClause.categoria = queryParams.categoria; }
    if (queryParams.tipoContrato) { whereClause.categoria_trab = queryParams.tipoContrato; }
    if (queryParams.filtro) {
        const hoje = new Date();
        if (queryParams.filtro === 'vencidas') { whereClause.dth_limite_ferias = { [Op.lt]: hoje }; }
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

const create = async (dadosFuncionario) => {
  return Funcionario.create(dadosFuncionario);
};

const findOne = async (matricula) => {
  return Funcionario.findByPk(matricula, {
    include: [
      { model: Ferias, as: 'historicoFerias', order: [['data_inicio', 'DESC']] },
      { model: Afastamento, as: 'historicoAfastamentos', order: [['data_inicio', 'DESC']] }
    ]
  });
};

const update = async (matricula, dadosParaAtualizar) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  delete dadosParaAtualizar.matricula;
  await funcionario.update(dadosParaAtualizar);
  return funcionario;
};

const remove = async (matricula) => {
  const funcionario = await Funcionario.findByPk(matricula);
  if (!funcionario) throw new Error('Funcionário não encontrado');
  await funcionario.destroy();
  return { message: 'Funcionário removido com sucesso.' };
};

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