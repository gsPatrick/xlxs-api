// src/app.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const allRoutes = require('./routes');
const db = require('./models'); // Importa o index.js que contém todos os modelos e a conexão.

const app = express();
const PORT = process.env.APP_PORT || 3000;

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', allRoutes);

const startServer = async () => {
  try {
    // 1. Autentica a conexão
    await db.sequelize.authenticate();
    console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso.');
    
    // 2. Sincroniza os modelos
    // ATENÇÃO: `force: true` apaga todas as tabelas e as recria. Use apenas em desenvolvimento.
    await db.sequelize.sync(); 
    console.log('Todos os modelos foram sincronizados com sucesso.');

    // 3. SEEDING DO USUÁRIO ADMIN
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    // ======================================================================
    // CORREÇÃO: Adicionado o nome do administrador padrão.
    // ======================================================================
    const adminName = 'Administrador Padrão';

    // Acessa o modelo User através do objeto db importado
    const adminExists = await db.User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
        await db.User.create({
            nome: adminName, // <--- CAMPO NOME ADICIONADO AQUI
            email: adminEmail,
            password: adminPassword,
            role: 'admin'
        });
        console.log(`>>> Usuário admin padrão criado:`);
        console.log(`>>> Nome: ${adminName}`);
        console.log(`>>> E-mail: ${adminEmail}`);
        console.log(`>>> Senha: ${adminPassword}`);
    }

    // 4. Inicia o servidor
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