// src/features/funcionario/funcionario-nested.routes.js

const express = require('express');
const afastamentoController = require('../afastamento/afastamento.controller');
const feriasController = require('../ferias/ferias.controller');

// O `mergeParams: true` é crucial para que esta rota tenha acesso ao `:matricula` da rota pai.
const router = express.Router({ mergeParams: true });

// Rota: POST /api/funcionarios/:matricula/afastamentos
router.post('/afastamentos', afastamentoController.create);

// Rota: POST /api/funcionarios/:matricula/ferias
router.post('/ferias', feriasController.create);

module.exports = router;