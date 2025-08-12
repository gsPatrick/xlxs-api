// src/features/funcionario/funcionario.routes.js

const express = require('express');
const multer = require('multer');
const funcionarioController = require('./funcionario.controller');
const afastamentoController = require('../afastamento/afastamento.controller'); 

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Para o upload de CSV

// --- Rotas para a coleção de funcionários ---

// POST /api/funcionarios/import -> Importa uma planilha CSV de funcionários
router.post('/import', upload.single('file'), funcionarioController.importCSV);

// GET /api/funcionarios -> Lista todos os funcionários com filtros avançados
router.get('/', funcionarioController.findAll);

// POST /api/funcionarios -> Adiciona um novo funcionário manualmente
router.post('/', funcionarioController.create);

// GET /api/funcionarios/export-all -> Exporta todos os dados cadastrais para CSV/XLSX
router.get('/export-all', funcionarioController.exportAll);


// --- Rotas para um funcionário específico, identificado pela matrícula ---

// GET /api/funcionarios/:matricula -> Busca os detalhes de um único funcionário
router.get('/:matricula', funcionarioController.findOne);

// PUT /api/funcionarios/:matricula -> Atualiza os dados de um funcionário
router.put('/:matricula', funcionarioController.update);

// DELETE /api/funcionarios/:matricula -> Exclui um funcionário
router.delete('/:matricula', funcionarioController.remove);
router.post('/:matricula/afastamentos', afastamentoController.create);


module.exports = router;