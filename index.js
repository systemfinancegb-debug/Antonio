const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rota raiz para teste de conexão
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK', mensagem: 'API Financeira rodando com sucesso no Render!' });
});

// 2. ROTA PÚBLICA DE AUTENTICAÇÃO (Login / Cadastro)
app.use('/api/auth', authRoutes);

// --- ROTA DE REPLICAÇÃO EM LOTE ---
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
    const setQuery = campos.map((campo, index) => `${campo} = $${index + 1}`).join(', ');
    const valoresBase = campos.map(campo => alteracoes[campo]);

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

// --- ROTAS DE GERENCIAMENTO DE USUÁRIOS ---

// Listar todos os usuários
app.get('/api/usuarios', authMiddleware, async (req, res) => {
  try {
    const resultado = await db.query('SELECT id, nome, email FROM usuarios ORDER BY id ASC');
    res.json(resultado.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar usuários:', err);
    res.status(500).json({ erro: 'Erro interno ao buscar usuários.' });
  }
});

// Cadastrar novo usuário
app.post('/api/usuarios', authMiddleware, async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const query = 'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email';
    const novoUsuario = await db.query(query, [nome, email, senhaHash]);
    res.status(201).json(novoUsuario.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao cadastrar usuário:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário (e-mail já pode estar em uso).' });
  }
});

// Atualizar usuário existente
app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha } = req.body;

  try {
    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      const query = 'UPDATE usuarios SET nome = $1, email = $2, senha = $3 WHERE id = $4 RETURNING id, nome, email';
      const atualizado = await db.query(query, [nome, email, senhaHash, id]);
      return res.json(atualizado.rows[0]);
    } else {
      const query = 'UPDATE usuarios SET nome = $1, email = $2 WHERE id = $3 RETURNING id, nome, email';
      const atualizado = await db.query(query, [nome, email, id]);
      return res.json(atualizado.rows[0]);
    }
  } catch (err) {
    console.error('❌ Erro ao atualizar usuário:', err);
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
});

// --- ROTA DEDICADA PARA ARQUIVAR / DESARQUIVAR CATEGORIA ---
app.patch('/api/categorias/:id/arquivar', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { arquivado } = req.body;

  if (typeof arquivado !== 'boolean') {
    return res.status(400).json({ erro: 'O campo "arquivado" deve ser booleano (true ou false).' });
  }

  try {
    const query = 'UPDATE categorias SET arquivado = $1 WHERE id = $2 RETURNING *';
    const resultado = await db.query(query, [arquivado, id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao alterar status de arquivamento da categoria:', err);
    res.status(500).json({ erro: 'Erro interno ao atualizar categoria.' });
  }
});

// 3. ROTAS PROTEGIDAS
app.use('/api/transacoes', authMiddleware, transacaoRoutes);
app.use('/api/categorias', authMiddleware, categoriaRoutes);

// 4. TAREFA AGENDADA: Limpeza diária da lixeira
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