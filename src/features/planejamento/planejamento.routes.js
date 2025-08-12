// src/features/planejamento/planejamento.routes.js
const express = require('express');
const planejamentoController = require('./planejamento.controller');

const router = express.Router();

// GET /api/planejamentos -> Lista todos os planejamentos, com filtro opcional por ano
router.get('/', planejamentoController.findAll);

// PUT /api/planejamentos/:id/ativar -> Ativa (restaura) um planejamento específico
router.put('/:id/ativar', planejamentoController.ativar);

module.exports = router;