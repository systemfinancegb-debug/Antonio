const { Pool } = require('pg');
require('dotenv').config();

// Configuração do Pool utilizando variáveis de ambiente
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Configurações recomendadas para produção:
  max: 10, // Máximo de clientes no pool
  idleTimeoutMillis: 30000, // Fecha conexões ociosas após 30s
  connectionTimeoutMillis: 2000, // Retorna erro se a conexão demorar mais de 2s
});

// Trata erros inesperados em conexões ociosas no pool
pool.on('error', (err, client) => {
  console.error('Erro inesperado no cliente ocioso do PostgreSQL', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};