# Solar Standard Protocol – TC-S Network Foundation

**1 Solar = 4,913 kWh** (reference date: 2025-04-07)

Open protocol for AI agents and energy ledgers to discover and integrate renewable energy tracking.

---

## 📋 Protocol Files

- **JSON Spec**: `/SolarStandard.json` - Machine-readable protocol definition
- **Human Docs**: `/SolarStandard.html` - SEO-optimized documentation
- **Atom Feed**: `/SolarFeed.xml` - Syndication feed for indexed artifacts

---

## 🔌 API Endpoints

### 1. kWh to Solar Conversion
```bash
GET /api/solar?kWh=9826
```

### 2. Protocol Spec + Health Check
```bash
GET /api/solar-standard
```

### 3. Artifact Enrichment (JSON-LD)
```bash
POST /api/solar/artifact
Content-Type: application/json

{
  "id": "artifact-001",
  "asset_type": "AI_MODEL",
  "energy_consumed_kWh": 15000,
  "renewable_source": "SOLAR",
  "verification": "REC",
  "geo_origin": "US-CA"
}
```

**CORS**: All endpoints support cross-origin requests (`Access-Control-Allow-Origin: *`)

---

## 🤖 Auto-Indexing System

Index artifacts with energy footprint data:

```bash
node SolarStandard/generators/solar-index.cjs \
  --id=artifact-001 \
  --type=DIGITAL_ARTIFACT \
  --kwh=9826 \
  --name="Artifact Name" \
  --verification=REC \
  --source=SOLAR \
  --geo=US-CA
```

**Parameters:**
- `--id` (required): Unique identifier
- `--type` (required): `DIGITAL_ARTIFACT | AI_MODEL | DATA_CENTER | TOKEN`
- `--kwh` (required): Energy consumed in kWh
- `--name` (required): Human-readable name
- `--verification` (optional): `REC | PPA | BLOCKCHAIN | SELF_REPORTED`
- `--source` (optional): `SOLAR | WIND | HYDRO | MIXED | UNKNOWN`
- `--geo` (optional): ISO country code or `US-{STATE}`

**Outputs:**
1. JSON-LD file at `/public/solar-index/{id}.json`
2. Appends entry to `/SolarFeed.xml` with updated timestamp

---

## 🐍 Python/FastAPI Mirror

Alternative implementation available at `/python_api/`:

```bash
cd python_api
pip install fastapi uvicorn
python main.py
```

See `/python_api/README.md` for details.

---

## 💾 Supabase Schema

Database-backed indexing schema available at `/SolarStandard/supabase-schema.sql`:

- Table: `solar_assets` with auto-calculated `solar_equivalent` column
- View: `solar_assets_json` exports JSON-LD format
- Indexes on `slug` and `asset_type` for efficient queries

---

## 🌐 Integration Example

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Embed Solar Standard JSON-LD -->
  <script type="application/ld+json" src="/solar-index/artifact-001.json"></script>
  
  <!-- Protocol Discovery Links -->
  <link rel="standard" href="/SolarStandard.html" title="Solar Standard Protocol v1.0">
  <link rel="alternate" type="application/atom+xml" href="/SolarFeed.xml" title="Solar Protocol Feed">
</head>
<body>
  <h1>My Solar-Indexed Artifact</h1>
</body>
</html>
```

---

## 📚 Documentation

- **Implementation Guide**: `/SolarStandard/IMPLEMENTATION.md`
- **Generator README**: `/SolarStandard/README.md`
- **Python API**: `/python_api/README.md`
- **Supabase Schema**: `/SolarStandard/supabase-schema.sql`

---

## ✅ Current Status

**Total Indexed Artifacts**: 4
- Solar Standard Protocol v1.0 (protocol definition)
- Example GPT-4 Training Run (4,913 kWh = 1.0 Solar)
- Kid Solar Avatar – Intro Sequence (9,826 kWh = 2.0 Solar)
- Test CommonJS Generator (10,000 kWh = 2.035416 Solar)

**Feed**: https://www.thecurrentsee.org/SolarFeed.xml

---

## 📄 License

Creative Commons CC-BY 4.0 - Free to adopt and adapt with attribution.

---

## 🚀 Quick Start

1. **Test API endpoints**:
   ```bash
   curl https://www.thecurrentsee.org/api/solar-standard | jq
   ```

2. **Index your first artifact**:
   ```bash
   node SolarStandard/generators/solar-index.cjs \
     --id=my-artifact \
     --type=DIGITAL_ARTIFACT \
     --kwh=5000 \
     --name="My First Artifact"
   ```

3. **View the feed**:
   ```bash
   curl https://www.thecurrentsee.org/SolarFeed.xml
   ```

---

**Protocol Version**: 1.0  
**Maintained by**: TC-S Network Foundation, Inc.  
**Website**: https://www.thecurrentsee.org
