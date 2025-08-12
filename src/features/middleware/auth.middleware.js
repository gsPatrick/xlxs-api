// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const protect = (req, res, next) => {
    let token;
    
    // O token geralmente vem no cabeçalho 'Authorization' como 'Bearer <token>'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extrai o token
            token = req.headers.authorization.split(' ')[1];
            
            // Verifica o token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Anexa os dados do usuário à requisição para uso posterior
            req.user = decoded;
            
            next(); // Prossegue para a próxima função (o controlador da rota)
        } catch (error) {
            res.status(401).send({ message: 'Não autorizado, token inválido.' });
        }
    }

    if (!token) {
        res.status(401).send({ message: 'Não autorizado, nenhum token fornecido.' });
    }
};

module.exports = { protect };