// src/features/relatorios/relatorios.routes.js
const express = require('express');
const relatoriosController = require('./relatorios.controller');

const router = express.Router();

// MUDANÇA: A rota de exportação de funcionários agora é um POST
router.post('/funcionarios', relatoriosController.gerarRelatorioFuncionarios);

// As outras rotas permanecem
router.get('/risco-vencimento', relatoriosController.gerarRelatorioRiscoVencimento);
router.get('/projecao-custos', relatoriosController.gerarRelatorioProjecaoCustos);
router.get('/aviso-ferias/:feriasId', relatoriosController.gerarAvisoFerias);

module.exports = router;