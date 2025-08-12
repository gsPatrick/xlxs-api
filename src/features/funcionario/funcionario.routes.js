// src/features/funcionario/funcionario.routes.js

const express = require('express');
const multer = require('multer');
const funcionarioController = require('./funcionario.controller');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Rota para importar arquivo (CSV ou XLSX)
// Garante que está chamando 'importFile' no controller
router.post('/import', upload.single('file'), funcionarioController.importFile);

// --- Outras rotas de funcionários ---
router.get('/', funcionarioController.findAll);
router.post('/', funcionarioController.create);
router.get('/export-all', funcionarioController.exportAll);
router.get('/:matricula', funcionarioController.findOne);
router.put('/:matricula', funcionarioController.update);
router.delete('/:matricula', funcionarioController.remove);

module.exports = router;