// server/db-mongo.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Fallback: se MONGODB_URI não vier do ambiente, usa a string fixa
const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://pedrocia_db_user:olaleotudocerto@cluster0.oaki90c.mongodb.net/?appName=Cluster0';

const dbName = process.env.MONGODB_DB || 'MTG_DB';

let client;
let db;

async function getDb() {
  if (db) return db;

  if (!uri) {
    // com o fallback lá em cima, isso aqui na prática NUNCA mais dispara
    throw new Error('MONGODB_URI não definido');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log(`Conectado ao MongoDB - DB: ${dbName}`);
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { getDb, closeDb };