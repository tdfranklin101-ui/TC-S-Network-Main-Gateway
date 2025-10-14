# Solar Standard Auto-Index Generator

Automatically index artifacts with energy footprint data and publish to Solar Standard feed.

## Usage

```bash
node SolarStandard/generators/solar-index.cjs \
  --id=artifact-123 \
  --type=DIGITAL_ARTIFACT \
  --kwh=2456.5 \
  --name="My Digital Artifact" \
  --verification=REC \
  --source=SOLAR \
  --geo=US-CA
```

## Parameters

- `--id` (required): Unique identifier for the artifact
- `--type` (required): One of `DIGITAL_ARTIFACT`, `AI_MODEL`, `DATA_CENTER`, `TOKEN`
- `--kwh` (required): Energy consumed in kWh
- `--name` (required): Human-readable artifact name
- `--verification` (optional): Verification method (default: `SELF_REPORTED`)
  - Options: `REC`, `PPA`, `BLOCKCHAIN`, `SELF_REPORTED`
- `--source` (optional): Energy source (default: `UNKNOWN`)
  - Options: `SOLAR`, `WIND`, `HYDRO`, `MIXED`, `UNKNOWN`
- `--geo` (optional): Geographic origin (default: `UNKNOWN`)
  - Format: ISO country code or `US-{STATE}` (e.g., `US-CA`, `DE`, `CN`)

## Output

1. **JSON-LD File**: `/public/solar-index/{id}.json`
   - Structured data for the artifact
   - Includes energy footprint and Solar equivalent
   - Can be embedded in HTML pages

2. **Feed Update**: `/public/SolarFeed.xml`
   - Appends new entry to Atom feed
   - Updates feed timestamp
   - Discoverable by AI agents and indexers

## Example: Embed in Artifact Page

```html
<!-- In /artifacts/{id}.html -->
<script type="application/ld+json" src="/solar-index/{id}.json"></script>
```

## Solar Conversion Formula

**1 Solar = 4,913 kWh**

Example:
- Input: 2,456.5 kWh
- Output: 0.5 Solar (2456.5 ÷ 4913)
