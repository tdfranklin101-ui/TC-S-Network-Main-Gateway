from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime

app = FastAPI(title="Solar Standard API (Python)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SOLAR_KWH = 4913

@app.get("/api/solar")
def convert(kWh: float):
    return {
        "kWh": kWh,
        "solar_equivalent": kWh / SOLAR_KWH,
        "unit": "Solar",
        "reference": "Solar Standard v1.0"
    }

@app.get("/api/solar-standard")
def standard():
    return {
        "name": "Solar Standard Protocol",
        "version": "1.0",
        "unit": {"symbol": "Solar", "kWh": SOLAR_KWH},
        "reference_date": "2025-04-07",
        "spec_url": "https://www.thecurrentsee.org/SolarStandard.json",
        "feed_url": "https://www.thecurrentsee.org/SolarFeed.xml",
        "status": "ok",
        "time": datetime.utcnow().isoformat() + "Z"
    }

@app.post("/api/solar/artifact")
async def artifact(req: Request):
    b = await req.json()
    kwh = float(b.get("energy_consumed_kWh", 0))
    if not kwh:
        return JSONResponse({"error":"energy_consumed_kWh required"}, status_code=400)
    payload = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": b.get("name") or b.get("id") or "Solar-tracked asset",
        "identifier": b.get("id"),
        "category": b.get("asset_type","DIGITAL_ARTIFACT"),
        "additionalProperty": [
            {"@type":"PropertyValue","name":"energy_consumed_kWh","value":kwh},
            {"@type":"PropertyValue","name":"solar_equivalent","value": round(kwh / SOLAR_KWH, 6)},
            {"@type":"PropertyValue","name":"renewable_source","value": b.get("renewable_source","UNKNOWN")},
            {"@type":"PropertyValue","name":"verification","value": b.get("verification","SELF_REPORTED")},
            {"@type":"PropertyValue","name":"geo_origin","value": b.get("geo_origin","UNKNOWN")},
            {"@type":"PropertyValue","name":"timestamp","value": datetime.utcnow().isoformat() + "Z"},
        ]
    }
    return payload

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
