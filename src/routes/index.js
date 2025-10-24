// src/routes/index.js

const express = require('express');
const { protect } = require('../features/middleware/auth.middleware');

// Importar todos os roteadores
const authRoutes = require('../features/auth/auth.routes');
const funcionarioRoutes = require('../features/funcionario/funcionario.routes');
const afastamentoRoutes = require('../features/afastamento/afastamento.routes');
const feriasRoutes = require('../features/ferias/ferias.routes');
const dashboardRoutes = require('../features/dashboard/dashboard.routes');
const relatoriosRoutes = require('../features/relatorios/relatorios.routes');
const planejamentoRoutes = require('../features/planejamento/planejamento.routes');
const userRoutes = require('../features/user/user.routes');
const alertasRoutes = require('../features/alertas/alertas.routes');
// ==========================================================
// NOVA IMPORTAÇÃO
// ==========================================================
const jobsRoutes = require('../features/jobs/jobs.routes');


const router = express.Router();

// ROTAS PÚBLICAS
router.use('/auth', authRoutes);

// MIDDLEWARE DE PROTEÇÃO
// router.use(protect); // Descomente para proteger todas as rotas abaixo

// ROTAS PRIVADAS
router.use('/funcionarios', funcionarioRoutes);
router.use('/afastamentos', afastamentoRoutes);
router.use('/ferias', feriasRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/relatorios', relatoriosRoutes);
router.use('/planejamentos', planejamentoRoutes);
router.use('/users', userRoutes);
router.use('/alertas', alertasRoutes);
// ==========================================================
// NOVO REGISTRO DE ROTA
// ==========================================================
router.use('/jobs', jobsRoutes);

module.exports = router;