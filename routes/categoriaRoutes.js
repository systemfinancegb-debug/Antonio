const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const autenticarToken = require('../middlewares/authMiddleware');

// Protege todas as rotas de categoria exigindo o token JWT
router.use(autenticarToken);

router.get('/', categoriaController.listarCategorias);
router.post('/', categoriaController.criarCategoria);

// Novas rotas para atualizar e excluir categorias por ID
router.put('/:id', categoriaController.atualizarCategoria);
router.delete('/:id', categoriaController.deletarCategoria);

module.exports = router;