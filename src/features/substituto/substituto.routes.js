// src/features/substituto/substituto.routes.js
const express = require('express');
const substitutoController = require('./substituto.controller');
const router = express.Router();

router.get('/', substitutoController.findAll);
router.post('/', substitutoController.create);
router.delete('/:id', substitutoController.remove);

module.exports = router;