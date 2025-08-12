const express = require('express');
const feriasController = require('./ferias.controller');

const router = express.Router();

router.post('/distribuir', feriasController.distribuir);
router.get('/', feriasController.listar);
router.put('/:id', feriasController.atualizar);
router.get('/export', feriasController.exportar);

// Lista registros de férias (com filtros, ex: ?planejamento=ativo)
router.get('/', feriasController.findAll);

// Aciona a distribuição automática de um novo planejamento
router.post('/distribuir', feriasController.distribuir);

module.exports = router;