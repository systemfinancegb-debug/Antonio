const db = require('../db');

const registrarLog = async (usuarioId, acao, descricao, ip = null) => {
  try {
    const queryText = `
      INSERT INTO logs_sistema (usuario_id, acao, descricao, ip_origem)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(queryText, [usuarioId, acao, descricao, ip]);
  } catch (error) {
    console.error('❌ Erro ao gravar log de auditoria:', error);
  }
};

module.exports = registrarLog;