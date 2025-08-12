// src/features/ferias/ferias.routes.js

const express = require('express');
const feriasController = require('./ferias.controller');

const router = express.Router();

// GET /api/ferias -> Lista registros de férias (com filtros, ex: ?planejamento=ativo)
// CORREÇÃO: Usar 'feriasController.findAll' em vez de um nome antigo.
router.get('/', feriasController.findAll);

// POST /api/ferias/distribuir -> Aciona a distribuição automática de um novo planejamento
router.post('/distribuir', feriasController.distribuir);

// --- Rotas de CRUD para um registro de Férias individual ---

// POST /api/ferias -> Cria um novo registro de férias
router.post('/', feriasController.create);

// PUT /api/ferias/:id -> Atualiza um registro de férias
router.put('/:id', feriasController.update);

// DELETE /api/ferias/:id -> Remove um registro de férias
router.delete('/:id', feriasController.remove);


module.exports = router;