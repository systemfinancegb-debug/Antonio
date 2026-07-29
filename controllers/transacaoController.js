const db = require('../db');
const registrarLog = require('../utils/logger');

// 1. Listar transações ATIVAS (Filtrando por Mês/Ano da Data de Vencimento)
exports.listarTransacoes = async (req, res) => {
  const { mes, ano } = req.query;

  try {
    let queryText = `
      SELECT t.*, c.nome as categoria_nome, ct.nome as conta_nome 
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      LEFT JOIN contas ct ON t.conta_id = ct.id
      WHERE t.deleted_at IS NULL
    `;
    const params = [];

    // Filtra pelo Mês e Ano do Vencimento/Competência
    if (mes && ano) {
      params.push(mes, ano);
      queryText += ` AND EXTRACT(MONTH FROM t.data_vencimento) = $1 AND EXTRACT(YEAR FROM t.data_vencimento) = $2`;
    }

    queryText += ` ORDER BY t.data_vencimento ASC, t.created_at DESC`;

    const resultado = await db.query(queryText, params);

    // Calcula os totais do mês exibido
    let receitas = 0;
    let despesas = 0;

    resultado.rows.forEach(t => {
      const valorNum = parseFloat(t.valor) || 0;
      const tipo = (t.tipo || '').toLowerCase();

      if (tipo === 'receita') receitas += valorNum;
      if (tipo === 'despesa') despesas += valorNum;
    });

    res.status(200).json({
      totais: {
        receitas,
        despesas,
        saldo: receitas - despesas
      },
      transacoes: resultado.rows
    });
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar transações' });
  }
};

// 2. BUSCAR TRANSAÇÕES SEMELHANTES FUTURAS (Para sugestão de exclusão em lote)
exports.buscarSemelhantes = async (req, res) => {
  const { descricao, valor, tipo, data_vencimento } = req.query;
  const usuarioId = req.usuarioId || req.usuario?.id;

  if (!descricao || !valor || !tipo || !data_vencimento) {
    return res.status(400).json({ erro: 'Parâmetros ausentes para a busca.' });
  }

  try {
    // Remove qualquer sufixo de parcelamento ex: " (1/12)" para comparar a descrição base
    const descricaoBase = descricao.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();

    const queryText = `
      SELECT t.id, t.descricao, t.valor, t.tipo, t.data_vencimento, c.nome AS categoria_nome
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      WHERE t.deleted_at IS NULL
        AND LOWER(TRIM(REGEXP_REPLACE(t.descricao, '\\s*\\(\\d+/\\d+\\)\\s*$', '', 'g'))) = LOWER(TRIM($1))
        AND ABS(t.valor - $2) < 0.01
        AND LOWER(t.tipo) = LOWER($3)
        AND t.data_vencimento >= $4
        ${usuarioId ? 'AND t.usuario_id = $5' : ''}
      ORDER BY t.data_vencimento ASC;
    `;

    const params = [descricaoBase, parseFloat(valor), tipo, data_vencimento];
    if (usuarioId) params.push(usuarioId);

    const resultado = await db.query(queryText, params);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao buscar transações semelhantes:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar lançamentos semelhantes' });
  }
};

// 3. Criar uma nova transação (com campo observacao e parcelamento para DESPESA e RECEITA)
exports.criarTransacao = async (req, res) => {
  const { 
    descricao, 
    valor, 
    tipo, 
    data_lancamento, 
    data_pagamento, 
    status, 
    categoria_id, 
    conta_id,
    observacao,
    parcelas = 1 
  } = req.body;

  const usuarioId = req.usuarioId || req.usuario?.id;

  try {
    const totalParcelas = parseInt(parcelas) || 1;
    const valorNum = parseFloat(valor);

    // LANÇAMENTO ÚNICO
    if (totalParcelas === 1) {
      const queryText = `
        INSERT INTO transacoes 
          (descricao, valor, tipo, data_lancamento, data_vencimento, data_pagamento, status, categoria_id, conta_id, usuario_id, observacao, parcela_atual, total_parcelas)
        VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, 1, 1)
        RETURNING *
      `;
      const valores = [
        descricao, valorNum, tipo, data_lancamento, 
        data_pagamento || null, status || 'PENDENTE', 
        categoria_id || null, conta_id || null, usuarioId || null,
        observacao || null
      ];

      const resultado = await db.query(queryText, valores);
      const novaTransacao = resultado.rows[0];

      if (usuarioId) {
        await registrarLog(usuarioId, 'CRIAR_TRANSACAO', `Criou o lançamento "${descricao}" no valor de R$ ${valorNum}.`);
      }

      return res.status(201).json(novaTransacao);
    }

    // LANÇAMENTO PARCELADO (Atende tanto DESPESA quanto RECEITA com proteção contra Timezone)
    const transacoesGeradas = [];
    const [anoBase, mesBase, diaBase] = data_lancamento.split('-').map(Number);

    for (let i = 1; i <= totalParcelas; i++) {
      const descParcelada = `${descricao} (${i}/${totalParcelas})`;
      
      // Projeta o vencimento preservando o dia correto nos meses subsequentes
      const dataVenc = new Date(Date.UTC(anoBase, (mesBase - 1) + (i - 1), diaBase));

      const queryText = `
        INSERT INTO transacoes 
          (descricao, valor, tipo, data_lancamento, data_vencimento, data_pagamento, status, categoria_id, conta_id, usuario_id, observacao, parcela_atual, total_parcelas)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const valores = [
        descParcelada, 
        valorNum, 
        tipo, 
        data_lancamento, 
        dataVenc.toISOString().split('T')[0], // Data formatada YYYY-MM-DD
        i === 1 ? data_pagamento || null : null, 
        i === 1 ? status || 'PENDENTE' : 'PENDENTE', 
        categoria_id || null, 
        conta_id || null, 
        usuarioId || null, 
        observacao || null,
        i, 
        totalParcelas
      ];

      const resDb = await db.query(queryText, valores);
      transacoesGeradas.push(resDb.rows[0]);
    }

    if (usuarioId) {
      await registrarLog(usuarioId, 'CRIAR_PARCELADO', `Criou lançamento parcelado "${descricao}" em ${totalParcelas}x de R$ ${valorNum}.`);
    }

    res.status(201).json(transacoesGeradas);

  } catch (error) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({ erro: 'Erro interno ao salvar transação' });
  }
};

// 4. Listar transações da LIXEIRA
exports.listarLixeira = async (req, res) => {
  try {
    const queryText = `
      SELECT t.*, c.nome as categoria_nome, ct.nome as conta_nome 
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      LEFT JOIN contas ct ON t.conta_id = ct.id
      WHERE t.deleted_at IS NOT NULL
      ORDER BY t.deleted_at DESC
    `;
    const resultado = await db.query(queryText);
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Erro ao buscar lixeira:', error);
    res.status(500).json({ erro: 'Erro interno ao buscar lixeira' });
  }
};

// 5. Mover transação para a Lixeira (com LOG)
exports.moverParaLixeira = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuarioId || req.usuario?.id;

  try {
    const queryText = `
      UPDATE transacoes 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING *
    `;
    const resultado = await db.query(queryText, [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Transação não encontrada' });
    }

    const transacaoExcluida = resultado.rows[0];

    if (usuarioId) {
      await registrarLog(
        usuarioId, 
        'MOVER_LIXEIRA', 
        `Moveu a transação ID ${id} (${transacaoExcluida.descricao}) para a lixeira.`
      );
    }

    res.status(200).json({ mensagem: 'Transação movida para a lixeira com sucesso!' });
  } catch (error) {
    console.error('Erro ao mover para a lixeira:', error);
    res.status(500).json({ erro: 'Erro interno ao mover para a lixeira' });
  }
};