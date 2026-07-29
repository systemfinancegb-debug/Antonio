const express = require('express');
const router = express.Router();
const transacaoController = require('../controllers/transacaoController');

// 1. GET /api/transacoes - Lista todas as ativas (filtrando por mês/ano de vencimento)
router.get('/', transacaoController.listarTransacoes);

// 2. GET /api/transacoes/lixeira - Lista itens da lixeira
router.get('/lixeira', transacaoController.listarLixeira);

// 3. GET /api/transacoes/semelhantes - Busca lançamentos futuros parecidos para exclusão em lote
router.get('/semelhantes', transacaoController.buscarSemelhantes);

// 4. POST /api/transacoes - Cria uma nova transação (única ou parcelada)
router.post('/', transacaoController.criarTransacao);

// 5. PUT /api/transacoes/:id - Atualiza/Edita uma transação existente
router.put('/:id', transacaoController.atualizarTransacao);

// 6. DELETE /api/transacoes/:id - Move para a lixeira
router.delete('/:id', transacaoController.moverParaLixeira);

module.exports = router;