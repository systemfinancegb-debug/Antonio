const db = require('../db');

// Listar todas as categorias do usuário logado
exports.listarCategorias = async (req, res) => {
  try {
    const queryText = 'SELECT * FROM categorias WHERE usuario_id = $1 ORDER BY nome ASC';
    const resultado = await db.query(queryText, [req.usuarioId]);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ erro: 'Erro interno ao listar categorias' });
  }
};

// Criar uma nova categoria vinculada ao usuário logado
exports.criarCategoria = async (req, res) => {
  const { nome, dia_vencimento } = req.body;[cite: 1]

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });[cite: 1]
  }

  try {
    const queryText = 'INSERT INTO categorias (nome, dia_vencimento, usuario_id) VALUES ($1, $2, $3) RETURNING *';
    const valorDia = dia_vencimento ? parseInt(dia_vencimento, 10) : null;
    const resultado = await db.query(queryText, [nome.trim(), valorDia, req.usuarioId]);
    res.status(201).json(resultado.rows[0]);[cite: 1]
  } catch (error) {
    if (error.code === '23505') { // Código do Postgres para UNIQUE violation
      return res.status(400).json({ erro: 'Categoria já cadastrada.' });[cite: 1]
    }
    console.error('Erro ao criar categoria:', error);[cite: 1]
    res.status(500).json({ erro: 'Erro interno ao salvar categoria' });[cite: 1]
  }
};

// Atualizar uma categoria existente do usuário logado
exports.atualizarCategoria = async (req, res) => {
  const { id } = req.params;[cite: 1]
  const { nome, dia_vencimento } = req.body;[cite: 1]

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });[cite: 1]
  }

  try {
    const queryText = 'UPDATE categorias SET nome = $1, dia_vencimento = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *';
    const valorDia = dia_vencimento ? parseInt(dia_vencimento, 10) : null;
    const resultado = await db.query(queryText, [nome.trim(), valorDia, id, req.usuarioId]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada ou sem permissão.' });
    }

    res.status(200).json(resultado.rows[0]);[cite: 1]
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'Já existe uma categoria com esse nome.' });[cite: 1]
    }
    console.error('Erro ao atualizar categoria:', error);[cite: 1]
    res.status(500).json({ erro: 'Erro interno ao atualizar categoria' });[cite: 1]
  }
};

// Excluir uma categoria do usuário logado
exports.deletarCategoria = async (req, res) => {
  const { id } = req.params;[cite: 1]

  try {
    const queryText = 'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2 RETURNING *';
    const resultado = await db.query(queryText, [id, req.usuarioId]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada ou sem permissão.' });
    }

    res.status(200).json({ mensagem: 'Categoria excluída com sucesso!' });[cite: 1]
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);[cite: 1]
    res.status(500).json({ erro: 'Erro interno ao excluir categoria' });[cite: 1]
  }
};