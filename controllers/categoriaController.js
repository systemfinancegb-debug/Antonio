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
  const { nome } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });
  }

  try {
    const queryText = 'INSERT INTO categorias (nome) VALUES ($1) RETURNING *';
    const resultado = await db.query(queryText, [nome.trim()]);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Código do Postgres para UNIQUE violation
      return res.status(400).json({ erro: 'Categoria já cadastrada.' });
    }
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ erro: 'Erro interno ao salvar categoria' });
  }
};

// Atualizar uma categoria existente
exports.atualizarCategoria = async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });
  }

  try {
    const queryText = 'UPDATE categorias SET nome = $1 WHERE id = $2 RETURNING *';
    const resultado = await db.query(queryText, [nome.trim(), id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    res.status(200).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'Já existe uma categoria com esse nome.' });
    }
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ erro: 'Erro interno ao atualizar categoria' });
  }
};

// Excluir uma categoria
exports.deletarCategoria = async (req, res) => {
  const { id } = req.params;

  try {
    const queryText = 'DELETE FROM categorias WHERE id = $1 RETURNING *';
    const resultado = await db.query(queryText, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    res.status(200).json({ mensagem: 'Categoria excluída com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    res.status(500).json({ erro: 'Erro interno ao excluir categoria' });
  }
};