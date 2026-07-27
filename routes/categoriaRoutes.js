const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const autenticarToken = require('../middlewares/authMiddleware');

// Protege todas as rotas de categoria exigindo o token JWT
router.use(autenticarToken);

router.get('/', categoriaController.listarCategorias);
router.post('/', categoriaController.criarCategoria);

module.exports = router;