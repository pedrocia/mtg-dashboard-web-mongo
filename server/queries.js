
module.exports = {
  kpis: {
    totalTorneios: "SELECT COUNT(*)::int AS v FROM torneio;",
    totalJogadores: "SELECT COUNT(*)::int AS v FROM jogador;",
    totalDecks: "SELECT COUNT(*)::int AS v FROM deck;",
    premioTotal: "SELECT COALESCE(SUM(premio_total),0)::numeric AS v FROM torneio;"
  },
  topPlayers: `
    SELECT j.id_jogador, j.nome_jogador,
           SUM(c.premios) AS premio_total,
           COUNT(*) AS eventos
    FROM classificacao c
    JOIN jogador j ON j.id_jogador = c.id_jogador
    GROUP BY j.id_jogador, j.nome_jogador
    ORDER BY premio_total DESC NULLS LAST
    LIMIT 10;
  `,
  deckWinrate: `
    SELECT d.id_deck, d.nome_deck, e.descricao AS estrategia,
           AVG(CASE WHEN p.result_partida = 1 THEN 1.0 ELSE 0.0 END) AS win_rate,
           COUNT(*) AS jogos
    FROM partida p
    JOIN deck d     ON d.id_deck = p.id_deck
    JOIN estrategia e ON e.id_strat = d.id_strat
    GROUP BY d.id_deck, d.nome_deck, e.descricao
    HAVING COUNT(*) >= 3
    ORDER BY win_rate DESC;
  `,
  cardsPopularity: `
    SELECT c.id_carta, c.nome_carta, SUM(dc.quantidade) AS total_no_meta
    FROM deck_carta dc
    JOIN carta c ON c.id_carta = dc.id_carta
    GROUP BY c.id_carta, c.nome_carta
    ORDER BY total_no_meta DESC NULLS LAST
    LIMIT 30;
  `,
  locations: `
    SELECT DISTINCT e.cidade, e.estado
    FROM endereco e
    JOIN torneio t ON t.id_endereco = e.id_endereco
    ORDER BY 1,2;
  `,
  formats: `
    SELECT DISTINCT formato FROM torneio ORDER BY 1;
  `,
  tournaments: `
    SELECT t.id_torneio, t.nome_torneio, t.formato, t.data_torneio, t.num_rodadas,
           e.cidade, e.estado, t.premio_total
    FROM torneio t
    JOIN endereco e ON e.id_endereco = t.id_endereco
    WHERE ($1::text IS NULL OR e.cidade = $1)
      AND ($2::text IS NULL OR t.formato = $2)
    ORDER BY t.data_torneio DESC;
  `,
  tournamentsList: `
    SELECT t.id_torneio, t.nome_torneio, t.data_torneio
    FROM torneio t
    ORDER BY t.data_torneio DESC;
  `,
metagameByTorneioId: `
  SELECT 
    m.top_strat     AS estrategia,
    m.top_1_card,
    m.top_2_card,
    m.top_3_card,
    m.top_4_card
  FROM metagame m
  JOIN torneio t 
    ON (t.id_endereco = m.id_endereco AND t.data_torneio = m.data_torneio)
  WHERE t.id_torneio = $1
  LIMIT 1;
`,

};
