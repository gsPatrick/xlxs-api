const feriasService = require('./ferias.service');


const listar = async (req, res) => {
  try {
    const ferias = await feriasService.listarFerias(req.query);
    res.status(200).send(ferias);
  } catch (error) {
    console.error('Erro ao listar férias:', error);
    res.status(500).send({ message: 'Falha ao listar férias.', error: error.message });
  }
};

const atualizar = async (req, res) => {
    try {
        const { id } = req.params;
        const feriaAtualizada = await feriasService.atualizarFeria(id, req.body);
        res.status(200).send(feriaAtualizada);
    } catch (error) {
        console.error('Erro ao atualizar férias:', error);
        res.status(500).send({ message: 'Falha ao atualizar férias.', error: error.message });
    }
};

const exportar = async (req, res) => {
    try {
        const csv = await feriasService.exportarParaCSV(req.query);
        if(!csv){
            return res.status(200).send("Nenhum dado para exportar com os filtros aplicados.");
        }
        res.header('Content-Type', 'text/csv');
        res.attachment('planejamento_ferias.csv');
        res.status(200).send(csv);
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        res.status(500).send({ message: 'Falha ao exportar CSV.', error: error.message });
    }
};

const findAll = async (req, res) => {
    try {
        const ferias = await feriasService.findAll(req.query);
        res.status(200).send(ferias);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao buscar férias.', error: error.message });
    }
};

const distribuir = async (req, res) => {
    try {
        const { ano, descricao } = req.body;
        const resultado = await feriasService.distribuirFerias(ano, descricao);
        res.status(200).send(resultado);
    } catch (error) {
        res.status(500).send({ message: 'Falha ao distribuir férias.', error: error.message });
    }
};

module.exports = { distribuir, findAll ,listar, atualizar, exportar };