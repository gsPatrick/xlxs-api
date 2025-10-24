// src/features/jobs/jobs.routes.js

const express = require('express');
const jobsController = require('./jobs.controller');
// const { protect } = require('../middleware/auth.middleware'); // Opcional: proteger a rota

const router = express.Router();

// POST /api/jobs/verificar-conflitos
// Aciona a verificação manual de conflitos entre férias e afastamentos
router.post('/verificar-conflitos', jobsController.executarVerificacaoConflitos);

module.exports = router;