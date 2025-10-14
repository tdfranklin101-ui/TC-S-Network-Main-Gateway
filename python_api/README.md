# Solar Standard API - Python/FastAPI Mirror

Python implementation of the Solar Standard Protocol API using FastAPI.

## Installation

```bash
pip install fastapi uvicorn
```

## Run Server

```bash
cd python_api
python main.py
```

The server will start on `http://0.0.0.0:5000`

## Endpoints

### 1. Convert kWh to Solar
```bash
GET /api/solar?kWh=9826

Response:
{
  "kWh": 9826,
  "solar_equivalent": 2.0,
  "unit": "Solar",
  "reference": "Solar Standard v1.0"
}
```

### 2. Protocol Spec + Health
```bash
GET /api/solar-standard

Response:
{
  "name": "Solar Standard Protocol",
  "version": "1.0",
  "unit": {"symbol": "Solar", "kWh": 4913},
  "reference_date": "2025-04-07",
  "spec_url": "https://www.thecurrentsee.org/SolarStandard.json",
  "feed_url": "https://www.thecurrentsee.org/SolarFeed.xml",
  "status": "ok",
  "time": "2025-10-14T16:45:00.000000Z"
}
```

### 3. Artifact Enrichment
```bash
POST /api/solar/artifact
Content-Type: application/json

{
  "id": "demo-1",
  "name": "Example AI Model",
  "asset_type": "AI_MODEL",
  "energy_consumed_kWh": 15000,
  "renewable_source": "WIND",
  "verification": "PPA",
  "geo_origin": "US-OR"
}

Response:
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Example AI Model",
  "identifier": "demo-1",
  "category": "AI_MODEL",
  "additionalProperty": [...]
}
```

## Features

- **CORS Enabled**: All endpoints support cross-origin requests
- **Schema.org Compliant**: Returns JSON-LD structured data
- **FastAPI Validation**: Automatic request validation and documentation
- **Auto-Generated Docs**: Visit `/docs` for interactive API documentation

## Deployment

### Replit
1. Set the run command to: `cd python_api && python main.py`
2. Ensure `fastapi` and `uvicorn` are in your Python packages

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY python_api/main.py .
RUN pip install fastapi uvicorn
CMD ["python", "main.py"]
```

## License

Part of the Solar Standard Protocol (CC-BY 4.0)
