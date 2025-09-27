# Prototype → Production Data Notes

## DynamoDB (suggested tables)
- **TCSGenerators**: generatorId (PK), name, location, tech, recCcSplitPct, payoutPrefs, fork, noCommissionerMode, createdAt
- **TCSGenerationBatches**: batchId (PK), generatorId (GSI), periodStart, periodEnd, mwh, meterProofRef, createdAt
- **TCSInstruments**: instrumentId (PK), generatorId (GSI), type (REC|CC), quantity, registryTxId, retired, createdAt
- **TCSMarketSales**: saleId (PK), generatorId (GSI), instrument, quantity, unitPrice, baseUnitPrice, delta, fork, noCommissionerMode, registryTxId, createdAt
- **TCSPayouts**: payoutId (PK), saleId (GSI), allocations (usdPct, raysPct), recipientWallets, executedAt
- **TCSGbiFund**: txId (PK), creditUsd, recPurchaseTx, raysMinted, distributionRuleId, createdAt

## Minimal SQL (for analytics)
```sql
CREATE TABLE generators (
  generator_id TEXT PRIMARY KEY,
  name TEXT, location TEXT, tech TEXT,
  rec_pct INTEGER, cc_pct INTEGER,
  usd_pct INTEGER, rays_pct INTEGER,
  fork TEXT, no_comm_mode TEXT,
  created_at TEXT
);

CREATE TABLE generation_batches (
  batch_id TEXT PRIMARY KEY,
  generator_id TEXT,
  period_start TEXT, period_end TEXT,
  mwh REAL, meter_proof_ref TEXT, created_at TEXT
);

CREATE TABLE market_sales (
  sale_id TEXT PRIMARY KEY,
  generator_id TEXT,
  instrument TEXT, quantity REAL,
  unit_price REAL, base_unit_price REAL,
  delta REAL, fork TEXT, no_comm_mode TEXT,
  registry_txid TEXT, created_at TEXT
);
```
