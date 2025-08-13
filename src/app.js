// src/app.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const allRoutes = require('./routes');
const db = require('./models');

const app = express();
const PORT = process.env.APP_PORT || 3000;

// ======================================================================
// CORREÇÃO CENTRAL: Configuração explícita do CORS
// ======================================================================
const corsOptions = {
  origin: '*', // Permite requisições de qualquer origem. Para produção, troque por 'http://seu-dominio-frontend.com'
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Métodos permitidos
  preflightContinue: false,
  optionsSuccessStatus: 204 // Alguns navegadores legados (IE11) engasgam com 204
};

// Usa as opções de CORS. Isso fará com que o Express responda
// automaticamente às requisições OPTIONS com status 204 (No Content) e os headers corretos.
app.use(cors(corsOptions));
// Também é uma boa prática habilitar o pre-flight para todas as rotas
app.options('*', cors(corsOptions)); 

// O restante do seu setup de middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Suas rotas
app.use('/api', allRoutes);

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso.');
    
    // ATENÇÃO: Em produção, considere usar `sync({ force: false, alter: true })` ou migrações.
    // `sync()` sem opções pode ser perigoso.
    await db.sequelize.sync(); 
    console.log('Todos os modelos foram sincronizados com sucesso.');

    // SEEDING DO USUÁRIO ADMIN
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminExists = await db.User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
        // Agora o modelo User requer um nome
        await db.User.create({
            nome: 'Administrador Padrão', // Adicionado nome padrão
            email: adminEmail,
            password: adminPassword,
            role: 'admin'
        });
        console.log(`>>> Usuário admin padrão criado:`);
        console.log(`>>> Nome: Administrador Padrão`);
        console.log(`>>> E-mail: ${adminEmail}`);
        console.log(`>>> Senha: ${adminPassword}`);
    }

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