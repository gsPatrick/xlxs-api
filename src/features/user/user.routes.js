// src/features/user/user.routes.js
const express = require('express');
const userController = require('./user.controller');

const router = express.Router();

router.get('/', userController.findAll);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.remove);

module.exports = router;