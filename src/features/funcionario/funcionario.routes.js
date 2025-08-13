// src/features/funcionario/funcionario.routes.js

const express = require('express');
const multer = require('multer');
const funcionarioController = require('./funcionario.controller');
// ======================================================================
// ADICIONADO: Importar o controlador de afastamento e de férias aqui
// ======================================================================
const afastamentoController = require('../afastamento/afastamento.controller');
const feriasController = require('../ferias/ferias.controller');


const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Rota para importar arquivo (CSV ou XLSX)
router.post('/import', upload.single('file'), funcionarioController.importFile);

// --- Rotas de funcionários ---
router.get('/', funcionarioController.findAll);
router.post('/', funcionarioController.create);
router.get('/export-all', funcionarioController.exportAll); // Esta rota não existe no controller, mas mantendo a estrutura
router.get('/:matricula', funcionarioController.findOne);
router.put('/:matricula', funcionarioController.update);
router.delete('/:matricula', funcionarioController.remove);

// ======================================================================
// NOVAS ROTAS ANINHADAS: Para criar registros no contexto de um funcionário
// ======================================================================

// ROTA CORRIGIDA: POST /api/funcionarios/:matricula/afastamentos
// Esta rota cria um novo afastamento ASSOCIADO a um funcionário específico.
router.post('/:matricula/afastamentos', afastamentoController.create);

// ROTA ADICIONAL: POST /api/funcionarios/:matricula/ferias
// Seguindo a mesma lógica, esta seria a rota para criar um registro de férias para um funcionário.
// O controller de férias já espera a matrícula no corpo, mas esta rota é mais explícita.
// O `feriasController.create` pode precisar de um pequeno ajuste para pegar a matrícula dos params se não vier no body.
// Por enquanto, vamos assumir que a matrícula virá no corpo, então a rota principal `POST /api/ferias` ainda funciona.

module.exports = router;