// server/server.js - versão MongoDB

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db-mongo');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ------------------------
// Health
// ------------------------
app.get('/api/health', async (req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true, version: 'MongoDB (ping ok)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ------------------------
// KPIs
// ------------------------
app.get('/api/kpis', async (req, res) => {
  try {
    const db = await getDb();

    const [totalTorneios, totalJogadores, decksAgg, premioAgg] = await Promise.all([
      db.collection('Torneios').countDocuments(),
      db.collection('Jogadores').countDocuments(),
      db.collection('Jogadores')
        .aggregate([
          {
            $project: {
              decksCount: {
                $size: { $ifNull: ['$decks', []] }
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$decksCount' }
            }
          }
        ])
        .toArray(),
      db.collection('Torneios')
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$premio_total' }
            }
          }
        ])
        .toArray()
    ]);

    res.json({
      totalTorneios,
      totalJogadores,
      totalDecks: decksAgg[0]?.total ?? 0,
      premioTotal: premioAgg[0]?.total ?? 0
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Top players
// ------------------------
app.get('/api/top-players', async (req, res) => {
  try {
    const db = await getDb();

    const rows = await db.collection('Torneios').aggregate([
      { $unwind: '$classificacao' },
      {
        $group: {
          _id: '$classificacao.id_jogador',
          premio_total: { $sum: '$classificacao.premios' },
          eventos: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'Jogadores',
          localField: '_id',
          foreignField: '_id',
          as: 'jogador'
        }
      },
      { $unwind: '$jogador' },
      {
        $project: {
          _id: 0,
          id_jogador: '$jogador._id',
          nome_jogador: '$jogador.nome',
          premio_total: 1,
          eventos: 1
        }
      },
      { $sort: { premio_total: -1 } },
      { $limit: 10 }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Deck winrate
// ------------------------
app.get('/api/deck-winrate', async (req, res) => {
  try {
    const db = await getDb();

    const rows = await db.collection('Torneios').aggregate([
      { $unwind: '$partidas' },
      {
        $lookup: {
          from: 'Jogadores',
          let: {
            jogadorId: '$partidas.id_jogador',
            deckId: '$partidas.id_deck'
          },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$jogadorId'] } } },
            { $unwind: '$decks' },
            { $match: { $expr: { $eq: ['$decks._id', '$$deckId'] } } },
            {
              $project: {
                _id: 0,
                nome_deck: '$decks.nome_deck',
                estrategia: '$decks.estrategia'
              }
            }
          ],
          as: 'deckInfo'
        }
      },
      { $unwind: '$deckInfo' },
      {
        $group: {
          _id: {
            deckId: '$partidas.id_deck',
            nome_deck: '$deckInfo.nome_deck',
            estrategia: '$deckInfo.estrategia'
          },
          jogos: { $sum: 1 },
          vitorias: {
            $sum: {
              $cond: [{ $eq: ['$partidas.resultado', 1] }, 1, 0]
            }
          }
        }
      },
      { $match: { jogos: { $gte: 3 } } },
      {
        $project: {
          _id: 0,
          id_deck: '$_id.deckId',
          nome_deck: '$_id.nome_deck',
          estrategia: '$_id.estrategia',
          win_rate: {
            $cond: [
              { $gt: ['$jogos', 0] },
              { $divide: ['$vitorias', '$jogos'] },
              0
            ]
          },
          jogos: 1
        }
      },
      { $sort: { win_rate: -1 } }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Cards popularity
// ------------------------
app.get('/api/cards-popularity', async (req, res) => {
  try {
    const db = await getDb();

    const rows = await db.collection('Jogadores').aggregate([
      { $unwind: '$decks' },
      { $unwind: '$decks.cartas' },
      {
        $group: {
          _id: '$decks.cartas.id_carta',
          total_no_meta: { $sum: '$decks.cartas.quantidade' }
        }
      },
      {
        $lookup: {
          from: 'Cartas',
          localField: '_id',
          foreignField: '_id',
          as: 'carta'
        }
      },
      { $unwind: '$carta' },
      {
        $project: {
          _id: 0,
          id_carta: '$carta._id',
          nome_carta: '$carta.nome',
          total_no_meta: 1
        }
      },
      { $sort: { total_no_meta: -1 } },
      { $limit: 30 }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Filters: locations & formats
// ------------------------
app.get('/api/locations', async (req, res) => {
  try {
    const db = await getDb();

    const rows = await db.collection('Enderecos').aggregate([
      {
        $project: {
          _id: 0,
          cidade: 1,
          estado: 1
        }
      },
      {
        $group: {
          _id: { cidade: '$cidade', estado: '$estado' }
        }
      },
      {
        $project: {
          _id: 0,
          cidade: '$_id.cidade',
          estado: '$_id.estado'
        }
      },
      { $sort: { cidade: 1 } }
    ]).toArray();

    res.json(rows);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});


app.get('/api/formats', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.collection('Torneios').aggregate([
      { $group: { _id: '$formato' } },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          formato: '$_id'
        }
      }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Tournaments list (dropdowns)
// ------------------------
app.get('/api/tournaments/list', async (req, res) => {
  try {
    const db = await getDb();

    const rows = await db.collection('Torneios').aggregate([
      {
        $project: {
          _id: 0,
          id_torneio: '$_id',
          nome_torneio: '$nome_torneio',
          data_torneio: '$data_torneio'
        }
      },
      { $sort: { data_torneio: -1 } }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Tournaments with filters
// ------------------------
app.get('/api/tournaments', async (req, res) => {
  try {
    const db = await getDb();
    const cidade = req.query.cidade || null;
    const formato = req.query.formato || null;

    const pipeline = [
      {
        $lookup: {
          from: 'Enderecos',
          localField: 'id_endereco',
          foreignField: '_id',
          as: 'endereco'
        }
      },
      { $unwind: '$endereco' },
      {
        $match: {
          ...(cidade ? { 'endereco.cidade': cidade } : {}),
          ...(formato ? { formato } : {})
        }
      },
      { $sort: { data_torneio: -1 } },
      {
        $project: {
          _id: 0,
          id_torneio: '$_id',
          nome_torneio: '$nome_torneio',
          formato: 1,
          data_torneio: 1,
          num_rodadas: 1,
          cidade: '$endereco.cidade',
          estado: '$endereco.estado',
          premio_total: 1
        }
      }
    ];

    const rows = await db.collection('Torneios').aggregate(pipeline).toArray();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Metagame by torneio id
// ------------------------
app.get('/api/metagame', async (req, res) => {
  try {
    const id = parseInt(req.query.id_torneio, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id_torneio inválido' });
    }

    const db = await getDb();
    const rows = await db.collection('Torneios').aggregate([
      { $match: { _id: id } },
      {
        $project: {
          _id: 0,
          estrategia: '$metagame.top_strat',
          top_1_card: { $arrayElemAt: ['$metagame.top_cards', 0] },
          top_2_card: { $arrayElemAt: ['$metagame.top_cards', 1] },
          top_3_card: { $arrayElemAt: ['$metagame.top_cards', 2] },
          top_4_card: { $arrayElemAt: ['$metagame.top_cards', 3] }
        }
      }
    ]).toArray();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Players search (by name, aggregated stats)
// ------------------------
app.get('/api/players', async (req, res) => {
  try {
    const nome = (req.query.nome || '').trim();
    const db = await getDb();

    const pipeline = [
      { $unwind: '$classificacao' },
      {
        $group: {
          _id: '$classificacao.id_jogador',
          pontos_total: { $sum: '$classificacao.pontos_totais' },
          vitorias: { $sum: '$classificacao.vitorias' },
          derrotas: { $sum: '$classificacao.derrotas' },
          premio_total: { $sum: '$classificacao.premios' }
        }
      },
      {
        $lookup: {
          from: 'Jogadores',
          localField: '_id',
          foreignField: '_id',
          as: 'jogador'
        }
      },
      { $unwind: '$jogador' },
      ...(nome
        ? [
            {
              $match: {
                'jogador.nome': { $regex: nome, $options: 'i' }
              }
            }
          ]
        : []),
      {
        $project: {
          _id: 0,
          id_jogador: '$jogador._id',
          nome_jogador: '$jogador.nome',
          pontos_total: 1,
          vitorias: 1,
          derrotas: 1,
          premio_total: 1
        }
      },
      { $sort: { premio_total: -1, pontos_total: -1 } }
    ];

    const rows = await db.collection('Torneios').aggregate(pipeline).toArray();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ------------------------
// Start server
// ------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server on http://localhost:${port}`);
});
