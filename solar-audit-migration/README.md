# Solar Audit Migration Package

## Overview

This package contains everything needed to migrate the **Solar Intelligence Audit Layer (SAi-Audit)** from the **Current-See Platform** (TC-S Network Foundation) to the **Solar Reserve Tracker** platform.

**Migration Date:** November 1, 2025  
**Source Platform:** Current-See (TC-S Network Foundation)  
**Destination Platform:** Solar Reserve Tracker  
**Schema Version:** 1.0.0

### What's Being Migrated

The Solar Audit system is a comprehensive global energy monitoring platform that tracks power consumption across **8 core categories** and **6 global regions**, providing **48 data points** (8 categories × 6 regions) with regulatory-grade audit trails.

**8 Energy Categories:**
1. **Housing** - Residential electricity consumption
2. **Manufacturing** - Industrial electricity consumption  
3. **Transport** - Electric transportation (EVs + rail)
4. **Food/Agriculture** - Agricultural energy consumption
5. **Digital Services** - Data centers and IT infrastructure
6. **Money** - Cryptocurrency mining
7. **AI/ML** - Artificial intelligence compute infrastructure
8. **Government/Military** - Public services and defense facilities

**6 Global Regions:**
1. **GLOBAL_ASIA** - Asia-Pacific (4.7B population)
2. **GLOBAL_NORTH_AMERICA** - North America (600M)
3. **GLOBAL_EUROPE** - Europe including EU-27 (750M)
4. **GLOBAL_AFRICA** - African continent (1.4B)
5. **GLOBAL_LATIN_AMERICA** - Latin America & Caribbean (650M)
6. **GLOBAL_OCEANIA** - Oceania (45M)

**Data Freshness Tiers:**
- **LIVE_DAILY**: Real-time API data (EIA, DOE, USDA, DOD, Mempool.space)
- **QUARTERLY_API**: Eurostat quarterly updates (Europe)
- **ANNUAL_DATASET**: IEA/UN 2023 authoritative datasets (Global regions)

---

## Package Contents

```
solar-audit-migration/
├── database/
│   ├── 01-schema.sql         # Database schema for 8 tables
│   ├── 02-data.sql            # Sample seed data
│   └── 03-import.sh           # Automated import script
├── frontend/
│   └── solar-audit.html       # Dashboard with Chart.js visualizations
├── backend/
│   ├── api-endpoints.js       # 6 API endpoints
│   ├── feed-functions.js      # 8 category feed functions
│   └── iea-un-data-loader.js  # Global regional data loader
└── README.md                  # This file
```

---

## Part 1: Database Migration

### Prerequisites

- PostgreSQL 12+ installed
- Database connection credentials
- `psql` command-line tool available

### Environment Variables

Set these environment variables before importing:

```bash
export PGHOST=localhost          # Database host
export PGPORT=5432               # Database port
export PGDATABASE=solar_reserve_tracker  # Database name
export PGUSER=postgres           # Database user
export PGPASSWORD=your_password  # Database password (or use .pgpass)
```

### Import Steps

#### Option 1: Automated Import (Recommended)

```bash
cd solar-audit-migration/database
./03-import.sh
```

This script will:
1. Test database connectivity
2. Import schema from `01-schema.sql`
3. Import seed data from `02-data.sql`
4. Verify table counts
5. Display migration summary

#### Option 2: Manual Import

```bash
cd solar-audit-migration/database

# Import schema
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f 01-schema.sql

# Import data
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f 02-data.sql

# Verify
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "
  SELECT 
    (SELECT COUNT(*) FROM audit_categories) as categories,
    (SELECT COUNT(*) FROM audit_regions) as regions,
    (SELECT COUNT(*) FROM audit_data_sources) as sources,
    (SELECT COUNT(*) FROM energy_audit_log) as audit_entries;
"
```

### Database Tables

| Table | Description | Expected Records |
|-------|-------------|------------------|
| `audit_categories` | 8 energy categories | 8 |
| `audit_data_sources` | Data source registry | 8+ |
| `audit_regions` | Regional taxonomy | 10 (6 global + 4 US) |
| `audit_region_totals` | Regional energy breakdowns | 48+ (8 × 6 minimum) |
| `energy_audit_log` | Core audit ledger | 8+ |
| `solar_audit_categories` | Enhanced categories (Drizzle) | 8 |
| `solar_audit_data_sources` | Enhanced sources (Drizzle) | 8+ |
| `solar_audit_entries` | UUID-based ledger (Drizzle) | Variable |

---

## Part 2: Backend Integration

### Dependencies

Install required Node.js packages:

```bash
npm install @neondatabase/serverless node-fetch
```

### API Endpoints

The backend provides 6 RESTful API endpoints:

#### 1. POST /api/solar-audit/update
**Trigger manual data fetch from all 8 category feeds**

```bash
curl -X POST http://localhost:8080/api/solar-audit/update
```

Response:
```json
{
  "status": "SUCCESS",
  "message": "Solar Audit data update completed",
  "timestamp": "2025-11-01T15:30:00.000Z",
  "categories": 8,
  "regions": 6
}
```

#### 2. GET /api/solar-audit/entries
**Fetch full audit log with source details**

```bash
curl http://localhost:8080/api/solar-audit/entries
```

#### 3. GET /api/solar-audit/summary
**Get daily aggregates grouped by category**

```bash
curl http://localhost:8080/api/solar-audit/summary
```

Response:
```json
{
  "categories": [
    {
      "category": "housing",
      "totalKwh": "12500000000.00",
      "totalSolar": "2544000.00",
      "recordCount": 48
    }
  ],
  "global": {
    "totalKwh": 37180000000,
    "totalSolar": 7568000,
    "totalRecords": 384
  }
}
```

#### 4. GET /api/solar-audit/last
**Get latest update with regional breakdowns**

```bash
curl http://localhost:8080/api/solar-audit/last
```

#### 5. GET /api/solar-audit/logs?limit=20
**View update history (default 20, max 200)**

```bash
curl http://localhost:8080/api/solar-audit/logs?limit=50
```

#### 6. GET /auditlog
**Chart.js compatible flat array format**

```bash
curl http://localhost:8080/auditlog
```

### Integration Example

```javascript
const express = require('express');
const solarAuditAPI = require('./solar-audit-migration/backend/api-endpoints');

const app = express();

// Register Solar Audit endpoints
app.post('/api/solar-audit/update', solarAuditAPI.handleSolarAuditUpdate);
app.get('/api/solar-audit/entries', solarAuditAPI.handleSolarAuditEntries);
app.get('/api/solar-audit/summary', solarAuditAPI.handleSolarAuditSummary);
app.get('/api/solar-audit/last', solarAuditAPI.handleSolarAuditLast);
app.get('/api/solar-audit/logs', solarAuditAPI.handleSolarAuditLogs);
app.get('/auditlog', solarAuditAPI.handleAuditLog);

app.listen(8080, () => {
  console.log('Solar Reserve Tracker API running on port 8080');
});
```

### Feed Functions

The `feed-functions.js` module provides 8 live data feed functions:

```javascript
const feeds = require('./solar-audit-migration/backend/feed-functions');

// Fetch housing (residential) energy data
const housingData = await feeds.feedHousingKwh();
console.log(`Housing: ${housingData.kwh} kWh/day`);

// All 8 feed functions:
feeds.feedHousingKwh()              // 1. Residential
feeds.feedManufacturingKwh()        // 2. Industrial
feeds.feedTransportKwh()            // 3. Transportation
feeds.feedFoodAgricultureKwh()      // 4. Agriculture
feeds.feedDigitalServicesKwh()      // 5. Data Centers
feeds.feedMoneyKwh()                // 6. Cryptocurrency
feeds.feedAIMachineLearningKwh()    // 7. AI/ML
feeds.feedGovernmentMilitaryKwh()   // 8. Government/Military
```

Each feed function returns:
```javascript
{
  kwh: 12500000000,                    // Daily kWh
  globalRegionalBreakdown: {           // 6 global regions
    GLOBAL_ASIA: 10547945205,
    GLOBAL_NORTH_AMERICA: 1234567890,
    GLOBAL_EUROPE: 987654321,
    // ...
  },
  source: {
    name: "EIA Retail Sales – Residential",
    organization: "U.S. EIA",
    verificationLevel: "THIRD_PARTY",
    uri: "https://api.eia.gov",
    sourceType: "DIRECT"
  },
  note: "Detailed methodology description"
}
```

---

## Part 3: Frontend Dashboard

### Deploy Dashboard

Copy `solar-audit.html` to your public web directory:

```bash
cp solar-audit-migration/frontend/solar-audit.html /var/www/html/
```

### Dashboard Features

- **Real-time monitoring** of global energy consumption
- **Chart.js visualizations** (daily trends, sector breakdown)
- **48 data point coverage matrix** (8 categories × 6 regions)
- **Data freshness indicators** (LIVE, QUARTERLY, ANNUAL badges)
- **Manual update trigger** with loading states
- **JSON data export** for external analysis

### Access Dashboard

```
http://your-server/solar-audit.html
```

---

## Environment Variables Required

### Database Connection

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Or individual PostgreSQL variables:
```bash
PGHOST=localhost
PGPORT=5432
PGDATABASE=solar_reserve_tracker
PGUSER=postgres
PGPASSWORD=your_password
```

### API Keys (Optional - for live data feeds)

```bash
# EIA (U.S. Energy Information Administration)
EIA_API_KEY=your_eia_api_key

# Eurostat API (no key required, but recommended User-Agent)
USER_AGENT=YourApp/1.0

# Mempool.space (no key required - public API)
```

### Application Settings

```bash
PORT=8080                          # Server port
NODE_ENV=production                # Environment mode
TZ=UTC                            # Timezone for scheduled updates
```

---

## Automated Updates

### Daily Data Refresh

The system can be configured to automatically update data at 3:00 AM UTC daily using `node-schedule`:

```javascript
const schedule = require('node-schedule');
const { updateSolarAuditData } = require('./backend/api-endpoints');

// Schedule daily updates at 3:00 AM UTC
schedule.scheduleJob('0 3 * * *', async () => {
  console.log('⏰ Scheduled Solar Audit update triggered');
  await updateSolarAuditData();
});
```

### Cron Alternative

Or use system cron:

```cron
# /etc/crontab or crontab -e
0 3 * * * /usr/bin/curl -X POST http://localhost:8080/api/solar-audit/update
```

---

## Testing Checklist

### Database Tests

- [ ] All 8 tables created successfully
- [ ] Audit categories seeded (8 records)
- [ ] Audit regions seeded (10 records: 6 global + 4 US)
- [ ] Sample audit log entries present
- [ ] Foreign key relationships intact
- [ ] Indexes created on performance-critical columns

### API Tests

```bash
# Test database connectivity
curl http://localhost:8080/api/solar-audit/last

# Trigger manual update
curl -X POST http://localhost:8080/api/solar-audit/update

# Verify entries
curl http://localhost:8080/api/solar-audit/entries | jq length

# Check summary
curl http://localhost:8080/api/solar-audit/summary | jq .global

# View update logs
curl http://localhost:8080/api/solar-audit/logs?limit=5
```

### Dashboard Tests

- [ ] Dashboard loads without errors
- [ ] Coverage matrix displays 48 data points (8 × 6)
- [ ] Charts render correctly (Chart.js)
- [ ] Manual update button triggers data fetch
- [ ] Data freshness badges display correctly
- [ ] JSON export downloads successfully

### Data Integrity Tests

- [ ] SHA-256 hashes verify correctly
- [ ] Solar unit conversion accurate (1 Solar = 4,913 kWh)
- [ ] Regional breakdowns sum to totals
- [ ] No missing data for any category/region combination
- [ ] Timestamps in UTC format

---

## Troubleshooting

### Database Connection Issues

**Error:** `FATAL: database does not exist`

```bash
# Create database first
createdb -h $PGHOST -U $PGUSER solar_reserve_tracker

# Then run import
./03-import.sh
```

**Error:** `permission denied for schema public`

```bash
# Grant permissions
psql -h $PGHOST -U postgres -c "GRANT ALL ON SCHEMA public TO $PGUSER;"
```

### API Endpoint Issues

**Error:** `Database not available`

- Verify `DATABASE_URL` environment variable is set
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`
- Check database is running: `pg_isready -h $PGHOST`

**Error:** `Failed to fetch [category] data`

- Check if feed function dependencies are installed
- Verify API keys are set (if required)
- Review network connectivity to external APIs
- Check logs for specific error messages

### Dashboard Issues

**Charts not rendering**

- Verify Chart.js CDN is accessible
- Check browser console for JavaScript errors
- Ensure `/api/solar-audit/last` endpoint returns data

**"No data available" message**

- Trigger manual update: POST `/api/solar-audit/update`
- Verify database has audit entries: `SELECT COUNT(*) FROM energy_audit_log`
- Check backend logs for data fetch errors

---

## Data Sources Reference

| Category | Primary Source | Backup Source | Freshness |
|----------|---------------|---------------|-----------|
| Housing | EIA Residential API | IEA/UN 2023 | LIVE_DAILY |
| Manufacturing | EIA Industrial API | IEA/UN 2023 | LIVE_DAILY |
| Transport | DOE/AFDC | IEA/UN 2023 | CALCULATED |
| Food | USDA ERS | IEA/UN 2023 | CALCULATED |
| Digital Services | LBNL 2023 | IEA/UN 2023 | ANNUAL |
| Money | Mempool.space API | Cambridge CBECI | LIVE_DAILY |
| AI/ML | IEA AI Tracker | Goldman Sachs | CALCULATED |
| Government | DOD + FEMP | IEA/UN 2023 | CALCULATED |

### European Data (Eurostat)

| Category | Eurostat Dataset | Update Frequency |
|----------|------------------|------------------|
| Housing | nrg_bal_q (FC_OTH_HH_E) | Quarterly |
| Manufacturing | nrg_bal_q (FC_IND_E) | Quarterly |
| Transport | nrg_bal_q (FC_TRA_E) | Quarterly |

---

## Solar Standard Conversion

All energy measurements are converted to **Solar units** for the Solar Standard economy:

```
1 Solar = 4,913 kWh
```

**Example:**
```
12,500,000,000 kWh ÷ 4,913 = 2,544,000 Solar units
```

This standardization enables:
- Cross-platform energy accounting
- AI-to-AI ethical exchange protocols (UIM Handshake)
- Computronium value tracking
- Renewable energy credit verification

---

## Support & Maintenance

### Migration Support

For migration assistance, contact:
- **Technical Support**: [Your support email]
- **Documentation**: https://your-docs-site.com/solar-audit

### Ongoing Maintenance

- **Schema updates**: Migrate using numbered migration files
- **Data backups**: Daily automated backups recommended
- **API monitoring**: Track endpoint response times and error rates
- **Data quality**: Monitor for missing regional data points

---

## License & Attribution

**Original Platform**: Current-See (TC-S Network Foundation)  
**Data Sources**: U.S. EIA, Eurostat, IEA, UN, DOE, USDA, DOD, Mempool.space, LBNL, Cambridge CBECI  
**Migration Package**: Version 1.0.0 (November 1, 2025)

---

## Appendix: SQL Quick Reference

### Common Queries

**Check latest audit entries:**
```sql
SELECT 
  date, 
  c.name as category, 
  energy_kwh / 1e6 as gwh_per_day,
  energy_solar
FROM energy_audit_log e
JOIN audit_categories c ON e.category_id = c.id
ORDER BY date DESC
LIMIT 10;
```

**Regional coverage matrix:**
```sql
SELECT 
  c.name as category,
  COUNT(DISTINCT art.region_code) as regions_covered
FROM audit_categories c
LEFT JOIN energy_audit_log e ON c.id = e.category_id
LEFT JOIN audit_region_totals art ON e.id = art.audit_log_id
GROUP BY c.name
ORDER BY c.name;
```

**Data freshness summary:**
```sql
SELECT 
  data_freshness,
  COUNT(*) as data_points,
  SUM(energy_kwh) / 1e6 as total_gwh_per_day
FROM audit_region_totals
GROUP BY data_freshness
ORDER BY data_freshness;
```

---

**End of Migration Guide** | Version 1.0.0 | November 1, 2025
