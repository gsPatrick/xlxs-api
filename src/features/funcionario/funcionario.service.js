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
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[._]/g, '')
        .replace(/\s+/g, '');
};

const columnMapping = {
    'matricula': 'matricula',
    'nomefuncionario': 'nome_funcionario',
    'dthadmissao': 'dth_admissao',
    'proximoperiodoaquisitivo': 'proximo_periodo_aquisitivo_texto',
    'proximoperiodoaquisitivoinicio': 'periodo_aquisitivo_atual_inicio',
    'proximoperiodoaquisitivofinal': 'periodo_aquisitivo_atual_fim',
    'datalimite': 'dth_limite_ferias',
    'datalimitefiltro': 'data_limite_filtro',
    'ultimadataplanejada': 'ultima_data_planejada',
    'ultimadataplanejadames': 'ultima_data_planejada_mes',
    'anoultimadataplanejada': 'ano_ultima_data_planejada',
    'qtdperiodosplanejados': 'qtd_periodos_planejados',
    'qtdperiodosgozo': 'qtd_periodos_gozo',
    'qtdperiodospendentes': 'qtd_periodos_pendentes',
    'qtdperiodoscompletos': 'qtd_periodos_completos',
    'qtdperiodosincompletos': 'qtd_periodos_incompletos',
    'qtdperiodosindividuais': 'qtd_periodos_individuais',
    'qtdperiodoscoletivos': 'qtd_periodos_coletivos',
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

const importFromXLSX = async (filePath, options = {}) => {
    const { data_inicio_distribuicao, data_fim_distribuicao } = options;
    console.log(`[LOG FUNCIONARIO SERVICE] Iniciando importação para: ${filePath}`);
    const t = await sequelize.transaction();

    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const headersRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1, raw: true })[0];
        console.log('[DIAGNÓSTICO] Cabeçalhos lidos:', headersRaw);

        const data = XLSX.utils.sheet_to_json(worksheet, { range: 1, raw: false, dateNF: 'dd/MM/yyyy' });
        
        console.log(`[LOG FUNCIONARIO SERVICE] ${data.length} linhas de dados encontradas.`);
        
        const funcionariosParaProcessar = [];
        const afastamentosParaCriar = [];
        let linhasInvalidas = 0;
        const matriculasDaPlanilha = new Set();

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const linhaNumero = i + 3;
            const funcionarioMapeado = {};
            for (const key in row) {
                const normalizedKey = normalizeHeader(key);
                if (columnMapping[normalizedKey]) {
                    funcionarioMapeado[columnMapping[normalizedKey]] = row[key] === '' ? null : row[key];
                }
            }
            
            if (!funcionarioMapeado.matricula || String(funcionarioMapeado.matricula).trim() === '' || !funcionarioMapeado.dth_admissao) {
                linhasInvalidas++;
                continue;
            }

            const datasParaConverter = ['dth_admissao', 'periodo_aquisitivo_atual_inicio', 'periodo_aquisitivo_atual_fim', 'dth_limite_ferias', 'data_limite_filtro', 'ultima_data_planejada'];
            let dataInvalida = false;
            for(const campoData of datasParaConverter) {
                if (funcionarioMapeado[campoData]) {
                    const dataString = String(funcionarioMapeado[campoData]);
                    const dataObj = parse(dataString, 'dd/MM/yyyy', new Date());
                    if (isNaN(dataObj.getTime())) {
                        console.warn(`[AVISO] Linha ${linhaNumero}: Data inválida para '${campoData}' valor '${dataString}'. Pulando.`);
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
            else if (faltas <= 14) funcionarioMapeado.saldo_dias_ferias = 24;
            else if (faltas <= 23) funcionarioMapeado.saldo_dias_ferias = 18;
            else if (faltas <= 32) funcionarioMapeado.saldo_dias_ferias = 12;
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
        
        console.log(`[LOG FUNCIONARIO SERVICE] Processamento concluído. ${funcionariosParaProcessar.length} válidos. ${linhasInvalidas} inválidas.`);

        if (funcionariosParaProcessar.length === 0) {
            throw new Error(`Nenhum registro válido encontrado.`);
        }
        
        await Funcionario.bulkCreate(funcionariosParaProcessar, {
            transaction: t,
            updateOnDuplicate: Object.values(columnMapping).filter(field => field !== 'matricula')
        });
        
        console.log(`[LOG FUNCIONARIO SERVICE] ${funcionariosParaProcessar.length} funcionários criados/atualizados.`);
        
        if (afastamentosParaCriar.length > 0) {
            await Afastamento.bulkCreate(afastamentosParaCriar, {
                transaction: t,
                updateOnDuplicate: ['data_fim', 'motivo', 'impacta_ferias'],
            });
            console.log(`[LOG FUNCIONARIO SERVICE] ${afastamentosParaCriar.length} afastamentos criados/atualizados.`);
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
            console.log(`[LOG FUNCIONARIO SERVICE] ${desativados} funcionários desativados.`);
        }
        
        const anoDistribuicao = data_inicio_distribuicao ? getYear(parseISO(data_inicio_distribuicao)) : new Date().getFullYear();
        
        await feriasService.distribuirFerias(anoDistribuicao, `Planejamento gerado após importação`, {
            transaction: t,
            dataInicioDist: data_inicio_distribuicao,
            dataFimDist: data_fim_distribuicao
        });

        await t.commit();
        
        fs.unlinkSync(filePath);
        return { message: `Importação concluída! ${funcionariosParaProcessar.length} funcionários processados. ${desativados} foram desativados. ${afastamentosParaCriar.length} afastamentos registrados. Um novo planejamento de férias foi gerado.` };

    } catch (err) {
        await t.rollback();
        console.error("[ERRO FATAL SERVICE] Transação revertida.", err);
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
            { matricula: { [Op.iLike]: `%${queryParams.q}%` } }
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

// ==========================================================
// NOVA FUNÇÃO PARA BUSCAR OPÇÕES DE FILTRO
// ==========================================================
const getFilterOptions = async () => {
    try {
        const municipios = await Funcionario.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('municipio_local_trabalho')), 'municipio_local_trabalho']],
            where: { municipio_local_trabalho: { [Op.not]: null } },
            order: [['municipio_local_trabalho', 'ASC']],
            raw: true
        });

        const gestoes = await Funcionario.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('des_grupo_contrato')), 'des_grupo_contrato']],
            where: { des_grupo_contrato: { [Op.not]: null } },
            order: [['des_grupo_contrato', 'ASC']],
            raw: true
        });

        const categorias = await Funcionario.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('categoria')), 'categoria']],
            where: { categoria: { [Op.not]: null } },
            order: [['categoria', 'ASC']],
            raw: true
        });
        
        const estados = await Funcionario.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('sigla_local')), 'sigla_local']],
            where: { sigla_local: { [Op.not]: null } },
            order: [['sigla_local', 'ASC']],
            raw: true
        });

        const escalas = await Funcionario.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('escala')), 'escala']],
            where: { escala: { [Op.not]: null } },
            order: [['escala', 'ASC']],
            raw: true
        });

        return {
            municipios: municipios.map(item => item.municipio_local_trabalho),
            gestoes: gestoes.map(item => item.des_grupo_contrato),
            categorias: categorias.map(item => item.categoria),
            estados: estados.map(item => item.sigla_local),
            escalas: escalas.map(item => item.escala),
        };
    } catch (error) {
        console.error("Erro ao buscar opções de filtro:", error);
        throw new Error("Não foi possível carregar as opções de filtro.");
    }
};


module.exports = {
  importFromXLSX,
  findAll,
  create,
  findOne,
  update,
  remove,
  exportAllToXLSX,
  getFilterOptions, // Exporta a nova função
};