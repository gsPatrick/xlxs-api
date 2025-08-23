// src/features/afastamento/afastamento.routes.js

const express = require('express');
const afastamentoController = require('./afastamento.controller');

const router = express.Router();

// GET /api/afastamentos -> Lista todos os afastamentos ativos, com filtros
router.get('/', afastamentoController.findAllActive);

// NOVO: DELETE /api/afastamentos/bulk -> Exclui múltiplos afastamentos
router.delete('/bulk', afastamentoController.bulkRemove);

// --- Rotas para um afastamento específico, identificado pelo seu ID ---

// GET /api/afastamentos/:id -> Busca um afastamento específico
router.get('/:id', afastamentoController.findOne);

// PUT /api/afastamentos/:id -> Atualiza um afastamento existente
router.put('/:id', afastamentoController.update);

// DELETE /api/afastamentos/:id -> Exclui um registro de afastamento
router.delete('/:id', afastamentoController.remove);

module.exports = router;