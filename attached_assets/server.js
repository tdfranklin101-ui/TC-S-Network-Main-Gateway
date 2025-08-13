// Prototype server (NOT LIVE).
// Node 18+, run: npm i express body-parser cors nanoid fs-extra
// then: node server.js
// Persists to a local JSON file for demo only.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_PATH = path.join(__dirname, 'mock-db.json');

function readDb() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { generators: [], batches: [], sales: [], payouts: [] };
  }
}
function writeDb(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

app.post('/api/generator/onboard', (req, res) => {
  const db = readDb();
  const g = req.body || {};
  g.generatorId = g.generatorId || nanoid();
  g.createdAt = new Date().toISOString();
  db.generators.push(g);
  writeDb(db);
  res.json({ ok: true, generatorId: g.generatorId });
});

app.post('/api/generation/ingest', (req, res) => {
  const db = readDb();
  const b = req.body || {};
  b.batchId = nanoid();
  b.createdAt = new Date().toISOString();
  db.batches.push(b);
  writeDb(db);
  res.json({ ok: true, batchId: b.batchId });
});

app.post('/api/market/sale', (req, res) => {
  const db = readDb();
  const s = req.body || {};
  s.saleId = nanoid();
  s.createdAt = new Date().toISOString();
  // naive delta calc example for REC
  if (s.instrument === 'REC') {
    const base = (s.baseUnitPrice || 0) * (s.quantity || 0);
    const revenue = (s.unitPrice || 0) * (s.quantity || 0);
    s.delta = Math.max(0, revenue - base);
  }
  db.sales.push(s);
  writeDb(db);
  res.json({ ok: true, saleId: s.saleId, delta: s.delta || 0 });
});

app.get('/api/debug/db', (req, res) => {
  res.json(readDb());
});

app.listen(8080, () => {
  console.log('Prototype server running on http://localhost:8080');
  console.log('NOT LIVE — demo only.');
});
