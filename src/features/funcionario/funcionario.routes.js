// src/features/funcionario/funcionario.routes.js

const express = require('express');
const multer = require('multer');
const funcionarioController = require('./funcionario.controller');
// ======================================================================
// IMPORTAÇÃO CORRIGIDA: Importa o novo roteador aninhado
// ======================================================================
const nestedRoutes = require('./funcionario-nested.routes');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ======================================================================
// MONTAGEM DAS ROTAS ANINHADAS
// Qualquer requisição para /api/funcionarios/:matricula/... será gerenciada pelo `nestedRoutes`.
// ======================================================================
router.use('/:matricula', nestedRoutes);

// Rota para importar arquivo
router.post('/import', upload.single('file'), funcionarioController.importFile);

// --- Rotas de funcionários (CRUD principal) ---
router.get('/', funcionarioController.findAll);
router.post('/', funcionarioController.create);
// router.get('/export-all', funcionarioController.exportAll); // Removido pois a rota de relatórios é mais flexível
router.get('/:matricula', funcionarioController.findOne);
router.put('/:matricula', funcionarioController.update);
router.delete('/:matricula', funcionarioController.remove);

module.exports = router;