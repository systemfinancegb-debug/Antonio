const { Pool } = require('pg');
require('dotenv').config();

// Verifica se existe a variável DATABASE_URL (usada no Render) ou variáveis individuais
const isProduction = !!process.env.DATABASE_URL;

const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Obrigatório para o PostgreSQL no Render
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000, // Aumentado para 5s para evitar timeout na subida inicial
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

// Trata erros inesperados em conexões ociosas no pool
pool.on('error', (err, client) => {
  console.error('Erro inesperado no cliente ocioso do PostgreSQL', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};