// src/routes/index.js

const express = require('express');
const { protect } = require('../features/middleware/auth.middleware');

// Importar todos os roteadores das features
const authRoutes = require('../features/auth/auth.routes');
const funcionarioRoutes = require('../features/funcionario/funcionario.routes');
const afastamentoRoutes = require('../features/afastamento/afastamento.routes');
const feriasRoutes = require('../features/ferias/ferias.routes');
// const relatoriosRoutes = require('../features/relatorios/relatorios.routes'); // Descomente quando criar este módulo
const dashboardRoutes = require('../features/dashboard/dashboard.routes'); // NOVO
const relatoriosRoutes = require('../features/relatorios/relatorios.routes'); // NOVO

const router = express.Router();

// --------------------------------------------------------------------------
// ROTAS PÚBLICAS
// --------------------------------------------------------------------------
// Endpoints que não exigem autenticação.
// Ex: Login, registro (se houver), recuperação de senha.

router.use('/auth', authRoutes);


// --------------------------------------------------------------------------
// MIDDLEWARE DE PROTEÇÃO
// --------------------------------------------------------------------------
// Todas as rotas definidas abaixo desta linha exigirão um token JWT válido.
// O middleware 'protect' irá interceptar a requisição e verificar o token.

router.use(protect);


// --------------------------------------------------------------------------
// ROTAS PRIVADAS
// --------------------------------------------------------------------------
// Endpoints que só podem ser acessados por usuários autenticados.

router.use('/funcionarios', funcionarioRoutes);
router.use('/afastamentos', afastamentoRoutes);
router.use('/ferias', feriasRoutes);
// router.use('/relatorios', relatoriosRoutes); // Descomente quando criar este módulo
router.use('/dashboard', dashboardRoutes); // NOVO
router.use('/relatorios', relatoriosRoutes); // NOVO


// Rota de teste para verificar se a proteção está funcionando
router.get('/test-protected', (req, res) => {
  res.status(200).send({
    message: 'Você acessou uma rota protegida com sucesso!',
    user: req.user // Dados do usuário extraídos do token pelo middleware
  });
});

module.exports = router;