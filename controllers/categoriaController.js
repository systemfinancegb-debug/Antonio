const db = require('../db');

// Listar todas as categorias
exports.listarCategorias = async (req, res) => {
  try {
    const resultado = await db.query('SELECT * FROM categorias ORDER BY nome ASC');
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ erro: 'Erro interno ao listar categorias' });
  }
};

// Criar uma nova categoria
exports.criarCategoria = async (req, res) => {
  const { nome, dia_vencimento } = req.body;[cite: 2]

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });[cite: 2]
  }

  try {
    const queryText = 'INSERT INTO categorias (nome, dia_vencimento) VALUES ($1, $2) RETURNING *';[cite: 2]
    const valorDia = dia_vencimento ? parseInt(dia_vencimento, 10) : null;
    const resultado = await db.query(queryText, [nome.trim(), valorDia]);[cite: 2]
    res.status(201).json(resultado.rows[0]);[cite: 2]
  } catch (error) {
    if (error.code === '23505') { // Código do Postgres para UNIQUE violation
      return res.status(400).json({ erro: 'Categoria já cadastrada.' });[cite: 2]
    }
    console.error('Erro ao criar categoria:', error);[cite: 2]
    res.status(500).json({ erro: 'Erro interno ao salvar categoria' });[cite: 2]
  }
};

// Atualizar uma categoria existente
exports.atualizarCategoria = async (req, res) => {
  const { id } = req.params;[cite: 2]
  const { nome, dia_vencimento } = req.body;[cite: 2]

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });[cite: 2]
  }

  try {
    const queryText = 'UPDATE categorias SET nome = $1, dia_vencimento = $2 WHERE id = $3 RETURNING *';[cite: 2]
    const valorDia = dia_vencimento ? parseInt(dia_vencimento, 10) : null;
    const resultado = await db.query(queryText, [nome.trim(), valorDia, id]);[cite: 2]

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });[cite: 2]
    }

    res.status(200).json(resultado.rows[0]);[cite: 2]
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'Já existe uma categoria com esse nome.' });[cite: 2]
    }
    console.error('Erro ao atualizar categoria:', error);[cite: 2]
    res.status(500).json({ erro: 'Erro interno ao atualizar categoria' });[cite: 2]
  }
};

// Excluir uma categoria
exports.deletarCategoria = async (req, res) => {
  const { id } = req.params;[cite: 2]

  try {
    const queryText = 'DELETE FROM categorias WHERE id = $1 RETURNING *';[cite: 2]
    const resultado = await db.query(queryText, [id]);[cite: 2]

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });[cite: 2]
    }

    res.status(200).json({ mensagem: 'Categoria excluída com sucesso!' });[cite: 2]
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);[cite: 2]
    res.status(500).json({ erro: 'Erro interno ao excluir categoria' });[cite: 2]
  }
};