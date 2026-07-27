const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const registrarLog = require('../utils/logger');

const CHAVE_SECRETA = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

// Registrar novo usuário
exports.cadastrar = async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const query = `
      INSERT INTO usuarios (nome, email, senha) 
      VALUES ($1, $2, $3) 
      RETURNING id, nome, email
    `;
    const resultado = await db.query(query, [nome, email, senhaHash]);
    const novoUsuario = resultado.rows[0];

    // Log de cadastro
    await registrarLog(novoUsuario.id, 'CADASTRO_USUARIO', `Usuário ${email} cadastrado.`);

    res.status(201).json(novoUsuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário ou e-mail já existente.' });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, senha } = req.body;

  try {
    const query = 'SELECT * FROM usuarios WHERE email = $1';
    const resultado = await db.query(query, [email]);

    if (resultado.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }

    const usuario = resultado.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }

    // Gera o token JWT (válido por 8 horas)
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, CHAVE_SECRETA, { expiresIn: '8h' });

    // Registra log de login
    await registrarLog(usuario.id, 'LOGIN', `Usuário ${usuario.nome} realizou login.`);

    res.json({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao realizar login.' });
  }
};