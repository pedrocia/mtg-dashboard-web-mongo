// server/db-mongo.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;          // ex: string do Atlas
const dbName = process.env.MONGODB_DB || 'MTG_DB';


let client;
let db;

async function getDb() {
  if (db) return db;

  if (!uri) {
    throw new Error('MONGODB_URI não definido no .env');
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
