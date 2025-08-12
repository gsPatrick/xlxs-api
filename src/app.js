// src/app.js

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const allRoutes = require('./routes');
const db = require('./models'); // Importa o index.js dos models, que inicializa o sequelize
const User = db.User; // Acessa o modelo User através do objeto db

// Cria a instância do aplicativo Express
const app = express();
const PORT = process.env.APP_PORT || 3000;

// Cria o diretório de uploads se não existir
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Middlewares essenciais
app.use(cors()); // Habilita o Cross-Origin Resource Sharing para permitir requisições do front-end
app.use(express.json()); // Habilita o parsing de corpos de requisição em formato JSON
app.use(express.urlencoded({ extended: true })); // Habilita o parsing de corpos de requisição URL-encoded

// Define o prefixo '/api' para todas as rotas definidas no arquivo de rotas principal
app.use('/api', allRoutes);

/**
 * Função principal assíncrona para iniciar o servidor.
 * Garante que a conexão com o banco de dados e a sincronização dos modelos
 * sejam concluídas antes de o servidor começar a aceitar requisições.
 */
const startServer = async () => {
  try {
    // 1. Autentica a conexão com o banco de dados
    await db.sequelize.authenticate();
    console.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso.');
    
    // 2. Sincroniza todos os modelos definidos com o banco de dados.
    // 'sync()' cria as tabelas se elas não existirem.
    // NUNCA use { force: true } em um ambiente de produção, pois isso apagaria todas as tabelas.
    await db.sequelize.sync(); 
    console.log('Todos os modelos foram sincronizados com sucesso.');

    // 3. INJEÇÃO (SEEDING) DO USUÁRIO ADMINISTRADOR
    // Este bloco garante que sempre haverá um usuário admin no sistema.
    // Ideal para o primeiro deploy ou para ambientes de desenvolvimento.
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminExists = await User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
        await User.create({
            email: adminEmail,
            password: adminPassword,
            role: 'admin' // Define o papel do usuário
        });
        console.log(`>>> Usuário admin padrão criado:`);
        console.log(`>>> E-mail: ${adminEmail}`);
        console.log(`>>> Senha: ${adminPassword}`);
    }

    // 4. Inicia o servidor Express para ouvir na porta configurada
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🔗 Acesso local: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Não foi possível conectar ao banco de dados ou iniciar o servidor:', error);
    process.exit(1); // Encerra o processo se não for possível conectar ao DB
  }
};

// Chama a função para iniciar o servidor
startServer();