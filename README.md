# TC-S Network – The Current-See Platform

**1 Solar = 4,913 kWh** (Genesis: 2025-04-07)

Solar-backed global economic platform with AI agent marketplace, renewable energy tracking, and the Solar Standard Protocol.

---

## Application

- **Runtime**: Node.js (Express)
- **Entry Point**: `main.js`
- **Database**: PostgreSQL (Neon)
- **Port**: Configured via `PORT` environment variable

## API Endpoints

### Solar Standard
- `GET /api/solar?kWh=9826` - kWh to Solar conversion
- `GET /api/solar-standard` - Protocol spec and health check
- `POST /api/solar/artifact` - Artifact enrichment (JSON-LD)

### Marketplace
- `GET /api/marketplace` - Browse marketplace listings
- `GET /api/artifacts` - Search artifacts
- `POST /api/artifacts` - Create artifact

### Solar Mint
- `GET /api/solar-mint/summary` - Minting stats
- `GET /api/solar-mint/ledger` - Daily entries
- `GET /api/solar-mint/live` - Real-time total

---

**Protocol Version**: 1.0
**Maintained by**: TC-S Network Foundation, Inc.
**Website**: https://www.thecurrentsee.org
