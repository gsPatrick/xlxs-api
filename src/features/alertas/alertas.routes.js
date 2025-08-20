// src/features/alertas/alertas.routes.js

const express = require('express');
const alertasController = require('./alertas.controller');

const router = express.Router();

// GET /api/alertas/retorno-afastamento?dias=30
router.get('/retorno-afastamento', alertasController.getRetornosProximos);

// ==========================================================
// NOVA ROTA (SEÇÃO 4.C DO PDF)
// ==========================================================
// GET /api/alertas/necessita-reprogramacao?periodo=30
router.get('/necessita-reprogramacao', alertasController.getNecessitaReprogramacao);


module.exports = router;