// src/features/ferias/ferias.routes.js

const express = require('express');
const feriasController = require('./ferias.controller');

const router = express.Router();

// GET /api/ferias/planejamento-ativo -> Lista o planejamento ativo com filtros e paginação
router.get('/planejamento-ativo', feriasController.findAllPaginated);

// POST /api/ferias/distribuir -> Aciona a distribuição automática para um ano inteiro
router.post('/distribuir', feriasController.distribuir);

// ==========================================================
// NOVA ROTA
// ==========================================================
// POST /api/ferias/redistribuir-selecionados -> Aciona a redistribuição para funcionários selecionados
router.post('/redistribuir-selecionados', feriasController.redistribuirSelecionadas);


// DELETE /api/ferias/bulk -> Exclui múltiplos registros de férias
router.delete('/bulk', feriasController.bulkRemove);

// --- Rotas de CRUD para um registro de Férias individual ---
router.post('/', feriasController.create);
router.put('/:id', feriasController.update);
router.delete('/:id', feriasController.remove);
router.put('/bulk-update-substitution', feriasController.bulkUpdateSubstitution);

module.exports = router;