// src/features/auth/auth.routes.js
const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;