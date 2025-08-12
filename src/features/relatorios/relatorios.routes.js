// src/features/relatorios/relatorios.routes.js
const express = require('express');
const relatoriosController = require('./relatorios.controller');

const router = express.Router();

// GET /api/relatorios/risco-vencimento -> Gera e retorna o XLSX de risco de vencimento
router.get('/risco-vencimento', relatoriosController.gerarRelatorioRiscoVencimento);

// GET /api/relatorios/projecao-custos -> Gera e retorna o XLSX de projeção de custos
router.get('/projecao-custos', relatoriosController.gerarRelatorioProjecaoCustos);

// GET /api/relatorios/aviso-ferias/:feriasId -> Gera e retorna o Aviso de Férias individual
router.get('/aviso-ferias/:feriasId', relatoriosController.gerarAvisoFerias);

module.exports = router;