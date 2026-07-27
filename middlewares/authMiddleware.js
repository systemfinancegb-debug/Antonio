const jwt = require('jsonwebtoken');
const CHAVE_SECRETA = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token de acesso não fornecido.' });
  }

  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, CHAVE_SECRETA);
    req.usuarioId = decoded.id; // Anexa o ID do usuário na requisição para usar nos controllers/logs
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
};