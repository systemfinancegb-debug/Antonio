const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Define as rotas (aqui é relativo a /api/auth)
router.post('/cadastrar', authController.cadastrar);
router.post('/login', authController.login);

module.exports = router;