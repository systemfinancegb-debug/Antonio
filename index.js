const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
require('dotenv').config();

// 1. IMPORTAÇÃO DOS MIDDLEWARES E ROTAS
const authMiddleware = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const transacaoRoutes = require('./routes/transacaoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes'); // <--- NOVO: Importa a rota de categorias

const app = express();

app.use(cors());
app.use(express.json());

// 2. ROTA PÚBLICA DE AUTENTICAÇÃO (Login / Cadastro)
app.use('/api/auth', authRoutes);

// 3. ROTAS PROTEGIDAS (Exigem o Token JWT para acessar)
app.use('/api/transacoes', authMiddleware, transacaoRoutes);
app.use('/api/categorias', authMiddleware, categoriaRoutes); // <--- NOVO: Registra a rota de categorias

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});