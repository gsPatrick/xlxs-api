// src/routes/index.js

const express = require('express');
const router = express.Router();

// Importação de todas as rotas dos features
const authRoutes = require('../features/auth/auth.routes');
const userRoutes = require('../features/user/user.routes');
const dashboardRoutes = require('../features/dashboard/dashboard.routes');
const funcionarioRoutes = require('../features/funcionario/funcionario.routes');
const afastamentoRoutes = require('../features/afastamento/afastamento.routes');
const feriasRoutes = require('../features/ferias/ferias.routes');
const planejamentoRoutes = require('../features/planejamento/planejamento.routes');
const relatoriosRoutes = require('../features/relatorios/relatorios.routes');
const alertasRoutes = require('../features/alertas/alertas.routes');
const jobsRoutes = require('../features/jobs/jobs.routes');

// ==========================================================
// NOVA IMPORTAÇÃO ADICIONADA AQUI
// ==========================================================
const substitutoRoutes = require('../features/substituto/substituto.routes');


// Middleware de proteção (se for usar em rotas específicas no futuro)
const { protect } = require('../middleware/auth.middleware');

// --- Rotas Públicas ---
router.use('/auth', authRoutes);

// --- Rotas Protegidas ---
// A partir daqui, todas as rotas podem ser protegidas com `protect`
// Exemplo: router.use('/users', protect, userRoutes);
// Por enquanto, vamos manter sem o middleware global para seguir o padrão atual.

router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/funcionarios', funcionarioRoutes);
router.use('/afastamentos', afastamentoRoutes);
router.use('/ferias', feriasRoutes);
router.use('/planejamentos', planejamentoRoutes);
router.use('/relatorios', relatoriosRoutes);
router.use('/alertas', alertasRoutes);
router.use('/jobs', jobsRoutes);

// ==========================================================
// NOVO REGISTRO DE ROTA ADICIONADO AQUI
// ==========================================================
router.use('/substitutos', substitutoRoutes);


// Rota de health check
router.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date() });
});

module.exports = router;