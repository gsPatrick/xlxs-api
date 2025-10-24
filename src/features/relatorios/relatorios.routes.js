// src/features/relatorios/relatorios.routes.js
const express = require('express');
const relatoriosController = require('./relatorios.controller');

const router = express.Router();

// ==========================================================
// NOVA ROTA
// ==========================================================
// GET /api/relatorios/planejamento -> Exporta os dados filtrados da tela de planejamento
router.get('/planejamento', relatoriosController.gerarRelatorioPlanejamento);


// Rota de exportação de funcionários agora é um POST para aceitar corpo com matrículas
router.post('/funcionarios', relatoriosController.gerarRelatorioFuncionarios);

// As outras rotas permanecem
router.get('/risco-vencimento', relatoriosController.gerarRelatorioRiscoVencimento);
router.get('/projecao-custos', relatoriosController.gerarRelatorioProjecaoCustos);
router.get('/aviso-ferias/:feriasId', relatoriosController.gerarAvisoFerias);

module.exports = router;