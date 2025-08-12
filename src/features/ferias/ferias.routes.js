const express = require('express');
const feriasController = require('./ferias.controller');

const router = express.Router();

router.post('/distribuir', feriasController.distribuir);
router.get('/', feriasController.listar);
router.put('/:id', feriasController.atualizar);
router.get('/export', feriasController.exportar);

module.exports = router;