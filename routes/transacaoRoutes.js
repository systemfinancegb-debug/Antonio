const express = require('express');
const router = express.Router();
const transacaoController = require('../controllers/transacaoController');

// 1. GET /api/transacoes - Lista todas as ativas
router.get('/', transacaoController.listarTransacoes);

// 2. GET /api/transacoes/lixeira - Lista itens da lixeira
router.get('/lixeira', transacaoController.listarLixeira);

// 3. POST /api/transacoes - Cria uma nova transação
router.post('/', transacaoController.criarTransacao);

// 4. DELETE /api/transacoes/:id - Move para a lixeira
router.delete('/:id', transacaoController.moverParaLixeira);

module.exports = router;