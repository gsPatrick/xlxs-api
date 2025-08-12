// src/features/dashboard/dashboard.routes.js
const express = require('express');
const dashboardController = require('./dashboard.controller');

const router = express.Router();

// GET /api/dashboard/summary -> Retorna os dados de resumo para os cards
router.get('/summary', dashboardController.getSummary);

module.exports = router;