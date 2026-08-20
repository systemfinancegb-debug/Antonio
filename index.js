const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

// E-mail do usuário Master (definido via .env ou padrão)
const EMAIL_MASTER = process.env.EMAIL_MASTER || 'systemfinancegb@gmail.com';

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

// Listar todos os usuários (Oculta o usuário Master e retorna o campo "ativo")
app.get('/api/usuarios', authMiddleware, async (req, res) => {
  try {
    const query = 'SELECT id, nome, email, COALESCE(ativo, true) AS ativo FROM usuarios WHERE email != $1 ORDER BY id ASC';
    const resultado = await db.query(query, [EMAIL_MASTER]);
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
    const query = 'INSERT INTO usuarios (nome, email, senha, ativo) VALUES ($1, $2, $3, true) RETURNING id, nome, email, ativo';
    const novoUsuario = await db.query(query, [nome, email, senhaHash]);
    res.status(201).json(novoUsuario.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao cadastrar usuário:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário (e-mail já pode estar em uso).' });
  }
});

// Alternar status de Ativo / Desativado (Soft Delete)
app.patch('/api/usuarios/:id/status', authMiddleware, async (req, res) => {
  const usuarioId = parseInt(req.params.id, 10);
  const { ativo } = req.body;

  if (isNaN(usuarioId)) {
    return res.status(400).json({ erro: 'ID de usuário inválido.' });
  }

  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ erro: 'O campo "ativo" deve ser booleano (true ou false).' });
  }

  try {
    // Impede alterar o status do Usuário Master
    const usuarioAlvo = await db.query('SELECT email FROM usuarios WHERE id = $1', [usuarioId]);
    if (usuarioAlvo.rows.length > 0 && usuarioAlvo.rows[0].email === EMAIL_MASTER) {
      return res.status(403).json({ erro: 'Este usuário é protegido e não pode ter seu status alterado.' });
    }

    const query = 'UPDATE usuarios SET ativo = $1 WHERE id = $2 RETURNING id, nome, email, ativo';
    const resultado = await db.query(query, [ativo, usuarioId]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao alterar status do usuário:', err);
    res.status(500).json({ erro: 'Erro interno ao atualizar status do usuário.' });
  }
});

// Atualizar usuário existente (Impede edição do usuário Master via API comum)
app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const usuarioId = parseInt(req.params.id, 10);
  const { nome, email, senha } = req.body;

  if (isNaN(usuarioId)) {
    return res.status(400).json({ erro: 'ID de usuário inválido.' });
  }

  try {
    // Verifica se o usuário que está sendo editado é o Master
    const usuarioAlvo = await db.query('SELECT email FROM usuarios WHERE id = $1', [usuarioId]);
    if (usuarioAlvo.rows.length > 0 && usuarioAlvo.rows[0].email === EMAIL_MASTER) {
      return res.status(403).json({ erro: 'Este usuário é protegido e não pode ser editado nesta rota.' });
    }

    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      const query = 'UPDATE usuarios SET nome = $1, email = $2, senha = $3 WHERE id = $4 RETURNING id, nome, email, COALESCE(ativo, true) AS ativo';
      const atualizado = await db.query(query, [nome, email, senhaHash, usuarioId]);
      return res.json(atualizado.rows[0]);
    } else {
      const query = 'UPDATE usuarios SET nome = $1, email = $2 WHERE id = $3 RETURNING id, nome, email, COALESCE(ativo, true) AS ativo';
      const atualizado = await db.query(query, [nome, email, usuarioId]);
      return res.json(atualizado.rows[0]);
    }
  } catch (err) {
    console.error('❌ Erro ao atualizar usuário:', err);
    res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
  }
});

// Excluir usuário permanentemente
app.delete('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const usuarioId = parseInt(req.params.id, 10);

  if (isNaN(usuarioId)) {
    return res.status(400).json({ erro: 'ID de usuário inválido.' });
  }

  try {
    // Impede a exclusão do Usuário Master
    const usuarioAlvo = await db.query('SELECT email FROM usuarios WHERE id = $1', [usuarioId]);
    if (usuarioAlvo.rows.length > 0 && usuarioAlvo.rows[0].email === EMAIL_MASTER) {
      return res.status(403).json({ erro: 'Este usuário é protegido e não pode ser excluído.' });
    }

    const query = 'DELETE FROM usuarios WHERE id = $1 RETURNING id';
    const resultado = await db.query(query, [usuarioId]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    res.json({ sucesso: true, mensagem: 'Usuário excluído permanentemente.' });
  } catch (err) {
    console.error('❌ Erro ao excluir usuário:', err);
    res.status(500).json({ erro: 'Erro ao excluir usuário (pode haver lançamentos vinculados a ele).' });
  }
});

// --- ROTA DEDICADA PARA ARQUIVAR / DESARQUIVAR CATEGORIA ---
app.patch('/api/categorias/:id/arquivar', authMiddleware, async (req, res) => {
  const categoriaId = parseInt(req.params.id, 10);
  const { arquivado } = req.body;

  if (isNaN(categoriaId)) {
    return res.status(400).json({ erro: 'ID de categoria inválido.' });
  }

  if (typeof arquivado !== 'boolean') {
    return res.status(400).json({ erro: 'O campo "arquivado" deve ser booleano (true ou false).' });
  }

  try {
    const query = 'UPDATE categorias SET arquivado = $1 WHERE id = $2 RETURNING *';
    const resultado = await db.query(query, [arquivado, categoriaId]);

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