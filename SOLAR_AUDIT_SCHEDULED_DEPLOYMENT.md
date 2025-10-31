# Solar Audit Layer - Scheduled Deployment Setup

## Overview
This document provides instructions for setting up automatic daily energy data updates for the Solar Intelligence Audit Layer (SAi-Audit) using Replit's Scheduled Deployments feature.

## What Gets Updated Daily
The system fetches live energy consumption data from authoritative sources:

1. **Money/Blockchain** - Bitcoin energy via Cambridge Bitcoin Electricity Consumption Index (CBECI)
2. **Housing** - U.S. residential electricity via EIA Retail Sales (sector: RES)
3. **Digital Services** - U.S. commercial electricity via EIA Retail Sales (sector: COM)
4. **Manufacturing** - U.S. industrial electricity via EIA Retail Sales (sector: IND)
5. **Transport** - U.S. transportation electricity via EIA Retail Sales (sector: TRA)
6. **Food/Agriculture** - U.S. other sector electricity via EIA Retail Sales (sector: OTH)

## Setup Instructions

### Step 1: Ensure EIA API Key is Set
The EIA_API_KEY secret must already be configured in Replit Secrets (✓ Already done)

### Step 2: Open Publishing Tool
1. In your Replit workspace, open the left sidebar
2. Click **"All tools"**
3. Select **"Publishing"**

### Step 3: Configure Scheduled Deployment
1. In the Publishing pane, select **"Scheduled"**
2. Click **"Set up your published app"**

### Step 4: Fill in Configuration

**Schedule Description** (natural language):
```
Every day at midnight UTC
```

This will be converted to cron expression: `0 0 * * *`

**Job Timeout**:
```
300
```
(5 minutes - plenty of time for all API calls to complete)

**Run Command**:
```bash
curl -X POST http://localhost:5000/api/solar-audit/update
```

**Deployment Secrets**:
Ensure these secrets are added:
- `EIA_API_KEY` (already configured)
- `DATABASE_URL` (already configured)

### Step 5: Deploy
Click **"Create Scheduled Deployment"** to activate

## Verification

### Check Logs After First Run
After the first scheduled execution (next UTC midnight), check:
1. Workflow logs for successful API calls
2. Database entries for new records

### Manual Trigger (Testing)
To test before the scheduled time:
```bash
curl -X POST http://localhost:5000/api/solar-audit/update
```

Expected response:
```json
{
  "status": "ok",
  "date": "2025-10-31",
  "recordsCreated": 6,
  "eiaDataAvailable": true
}
```

## API Response Codes

| Status | Meaning |
|--------|---------|
| `recordsCreated: 6` | All 6 categories updated successfully (Money + 5 EIA sectors) |
| `recordsCreated: 1` | Only Money/Bitcoin updated (EIA key missing or API failed) |
| `eiaDataAvailable: true` | EIA API key is configured |
| `eiaDataAvailable: false` | EIA API key is missing |

## Data Source Verification Levels

| Level | Meaning | Used For |
|-------|---------|----------|
| `THIRD_PARTY` | Verified by independent auditor/agency | CBECI (Bitcoin), EIA (all sectors) |
| `METERED` | Direct meter readings | Future: Smart meter integrations |
| `MODELLED` | Estimated/fallback values | Fallback scenarios when API fails |
| `SELF` | Self-reported data | Future: User-submitted data |

## Source Types

| Type | Meaning | Used For |
|------|---------|----------|
| `DIRECT` | Primary authoritative source | CBECI, EIA APIs |
| `AGGREGATOR` | Fallback/composite source | Not currently used (reserved for future) |

## Troubleshooting

### No Records Created
- **Check EIA_API_KEY**: Verify the key is valid at https://www.eia.gov/opendata/
- **Check API Status**: EIA APIs may be temporarily down
- **Check Logs**: Look for specific error messages in deployment logs

### Only 1 Record Created
- EIA API key is missing or invalid
- Only Bitcoin/CBECI data was fetched successfully
- Check `eiaDataAvailable: false` in response

### Duplicate Entry Errors
- Normal behavior - the system prevents duplicate daily entries per category
- Unique constraint on `(day, category_id)` ensures one record per category per day

## Dashboard Access
View audit data at: `https://your-repl.replit.app/solar-audit`

## Architecture Notes

### Data Flow
```
Daily Trigger (00:00 UTC)
    ↓
POST /api/solar-audit/update
    ↓
tieredFetch() for each category
    ↓
Live API Calls (CBECI, EIA v2)
    ↓
insertEnergyRecord()
    ↓
PostgreSQL (solar_audit_entries)
    ↓
Dashboard Visualization
```

### Energy Unit Conversions
- **EIA Data**: Monthly MWh → Daily kWh → Solar Units (÷ 4,913)
- **CBECI Data**: Annual TWh → Daily kWh → Solar Units (÷ 4,913)
- **1 Solar Unit** = 4,913 kWh (global solar constant)

### Data Integrity
- **SHA-256 Hashing**: Every record includes cryptographic hash for immutability
- **Rights Alignment**: JSON metadata tracks privacy/transparency policies
- **Audit Trail**: Full source metadata (organization, URI, verification level)

## Support
For issues or questions, contact the TC-S Network Foundation team.
