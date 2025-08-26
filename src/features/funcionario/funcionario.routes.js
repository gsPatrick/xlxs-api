// src/features/funcionario/funcionario.routes.js

const express = require('express');
const multer = require('multer');
const funcionarioController = require('./funcionario.controller');
const nestedRoutes = require('./funcionario-nested.routes');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Montagem das rotas aninhadas
router.use('/:matricula', nestedRoutes);

// Rota para importar arquivo
router.post('/import', upload.single('file'), funcionarioController.importFile);

// ==========================================================
// NOVA ROTA
// ==========================================================
// Rota para buscar as opções de filtro dinâmicas
router.get('/filter-options', funcionarioController.getFilterOptions);


// --- Rotas de funcionários (CRUD principal) ---
router.get('/', funcionarioController.findAll);
router.post('/', funcionarioController.create);
router.get('/:matricula', funcionarioController.findOne);
router.put('/:matricula', funcionarioController.update);
router.delete('/:matricula', funcionarioController.remove);

module.exports = router;