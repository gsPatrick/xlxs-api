// src/routes/index.js

const express = require('express');
const { protect } = require('../features/middleware/auth.middleware'); // Corrigindo o caminho do middleware

// Importar todos os roteadores
const authRoutes = require('../features/auth/auth.routes');
const funcionarioRoutes = require('../features/funcionario/funcionario.routes');
const afastamentoRoutes = require('../features/afastamento/afastamento.routes');
const feriasRoutes = require('../features/ferias/ferias.routes');
const dashboardRoutes = require('../features/dashboard/dashboard.routes');
const relatoriosRoutes = require('../features/relatorios/relatorios.routes');
const planejamentoRoutes = require('../features/planejamento/planejamento.routes');
const userRoutes = require('../features/user/user.routes');
const alertasRoutes = require('../features/alertas/alertas.routes'); // NOVO: Importar rotas de alertas

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
router.use('/alertas', alertasRoutes); // NOVO: Adicionar rotas de alertas

module.exports = router;