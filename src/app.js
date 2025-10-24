// src/app.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
// ==========================================================
// NOVA IMPORTAÇÃO
// ==========================================================
const cron = require('node-cron');
const jobsService = require('./features/jobs/jobs.service');


const allRoutes = require('./routes');
const db = require('./models');

const app = express();
const PORT = process.env.APP_PORT || 3000;

const corsOptions = {
  origin: '*',
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

app.use('/api', allRoutes);

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso.');
    
    await db.sequelize.sync({force: false}); 
    console.log('Todos os modelos foram sincronizados com sucesso.');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminExists = await db.User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
        await db.User.create({
            nome: 'Administrador Padrão',
            email: adminEmail,
            password: adminPassword,
            role: 'admin'
        });
        console.log(`>>> Usuário admin padrão criado.`);
    }

    // ==========================================================
    // NOVA SEÇÃO: AGENDAMENTO DA TAREFA (CRON JOB)
    // ==========================================================
    // Agenda a tarefa para rodar todos os dias à 1 da manhã.
    // O formato é: 'minuto hora dia-do-mês mês dia-da-semana'
    cron.schedule('0 1 * * *', () => {
      console.log('================================================');
      console.log('[CRON] Executando tarefa agendada: verificarConflitosDeAfastamento');
      jobsService.verificarConflitosDeAfastamento();
      console.log('================================================');
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo" // Defina o fuso horário apropriado
    });
    console.log('🕒 Job de verificação de conflitos agendado para rodar diariamente à 01:00.');
    // ==========================================================


    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🔗 Acesso local: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Não foi possível conectar ao banco de dados ou iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();