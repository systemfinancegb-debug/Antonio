const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
require('dotenv').config();

// 1. IMPORTAÇÃO DOS MIDDLEWARES E ROTAS
const authMiddleware = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const transacaoRoutes = require('./routes/transacaoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');

const app = express();

// Configuração explícita do CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rota raiz para teste de conexão
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', mensagem: 'API Financeira rodando com sucesso no Render!' });
});

// 2. ROTA PÚBLICA DE AUTENTICAÇÃO (Login / Cadastro)
app.use('/api/auth', authRoutes);

// --- NOVA ROTA DE REPLICAÇÃO EM LOTE (Evita Erro 500 e atualiza em uma única chamada) ---
app.put('/api/transacoes/replicar-lote', authMiddleware, async (req, res) => {
  const { ids_parcelas, alteracoes } = req.body;

  if (!ids_parcelas || !Array.isArray(ids_parcelas) || ids_parcelas.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma parcela informada para replicação.' });
  }

  const campos = Object.keys(alteracoes || {});
  if (campos.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma alteração foi enviada.' });
  }

  try {
    // Monta dinamicamente a query de UPDATE baseada estritamente nos campos alterados
    const setQuery = campos.map((campo, index) => `${campo} = $${index + 1}`).join(', ');
    const valoresBase = campos.map(campo => alteracoes[campo]);

    // Executa a atualização para cada ID de parcela vinculado ao usuário logado
    for (const id of ids_parcelas) {
      const queryFinal = `UPDATE transacoes SET ${setQuery} WHERE id = $${campos.length + 1} AND usuario_id = $${campos.length + 2}`;
      await db.query(queryFinal, [...valoresBase, id, req.usuarioId]);
    }

    return res.json({ sucesso: true, mensagem: 'Parcelas atualizadas em lote com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao atualizar parcelas em lote:', error);
    return res.status(500).json({ erro: 'Erro interno ao atualizar transações em lote.' });
  }
});

// 3. ROTAS PROTEGIDAS (Exigem o Token JWT para acessar)
app.use('/api/transacoes', authMiddleware, transacaoRoutes);
app.use('/api/categorias', authMiddleware, categoriaRoutes);

// 4. TAREFA AGENDADA: Limpeza diária da lixeira (itens com mais de 6 meses)
cron.schedule('0 0 * * *', async () => {
  console.log('🧹 Executando limpeza da lixeira (itens excluídos há mais de 6 meses)...');
  
  const queryLimpeza = `
    DELETE FROM transacoes 
    WHERE deleted_at IS NOT NULL 
      AND deleted_at < NOW() - INTERVAL '6 months';
  `;

  try {
    const resultado = await db.query(queryLimpeza);
    console.log(`✅ Limpeza concluída! ${resultado.rowCount} registros foram excluídos permanentemente.`);
  } catch (error) {
    console.error('❌ Erro ao executar limpeza da lixeira:', error);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});