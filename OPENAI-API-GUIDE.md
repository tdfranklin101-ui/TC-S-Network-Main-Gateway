# The Current-See OpenAI API Integration Guide

This guide explains the new OpenAI-powered API endpoints available in The Current-See application. These endpoints provide AI-driven insights and responses focused on solar energy, carbon footprints, and sustainability.

## API Endpoints

### 1. Energy Assistant API

**Endpoint:** `/api/ai/assistant`  
**Method:** POST  
**Description:** Get AI-generated responses to questions about solar energy, The Current-See, and sustainability.

**Request Body:**
```json
{
  "query": "How much solar energy has The Current-See generated so far?"
}
```

**Response:**
```json
{
  "query": "How much solar energy has The Current-See generated so far?",
  "response": "As of today (April 23, 2025), The Current-See has generated approximately 11.22 million kWh (11.222222 MkWh) of solar energy since its launch on April 7, 2025. This energy generation represents a monetary value of over $310 million, based on the Current-See's valuation of $136,000 per SOLAR token, where each SOLAR represents 4,913 kWh of solar energy.",
  "timestamp": "2025-04-23T20:45:10.123Z"
}
```

### 2. Product Energy Analysis API

**Endpoint:** `/api/ai/analyze-product`  
**Method:** POST  
**Description:** Analyze the energy footprint and sustainability of products.

**Request Body:**
```json
{
  "productInfo": {
    "name": "Organic Cotton T-Shirt",
    "type": "Clothing",
    "materials": "100% organic cotton",
    "location": "India",
    "weight": "0.2 kg",
    "additionalInfo": "Fair trade certified"
  }
}
```

**Response:**
```json
{
  "productInfo": {
    "name": "Organic Cotton T-Shirt",
    "type": "Clothing",
    "materials": "100% organic cotton",
    "location": "India",
    "weight": "0.2 kg",
    "additionalInfo": "Fair trade certified"
  },
  "analysis": {
    "energyEstimate": 8.2,
    "carbonFootprint": 2.1,
    "solarEquivalent": 0.00167,
    "insights": [
      "Organic cotton uses 30% less energy than conventional cotton",
      "Fair trade certification ensures ethical labor practices",
      "Local production would reduce transportation emissions"
    ],
    "recommendations": [
      "Look for shirts made with recycled materials",
      "Consider hemp or bamboo as even more sustainable alternatives",
      "Extend product life through proper care and washing"
    ]
  },
  "timestamp": "2025-04-23T20:45:30.456Z"
}
```

### 3. Personalized Energy Tips API

**Endpoint:** `/api/ai/energy-tips`  
**Method:** POST  
**Description:** Get personalized energy-saving tips based on user profile.

**Request Body:**
```json
{
  "userProfile": {
    "location": "California",
    "homeType": "Apartment",
    "residents": 2,
    "energyUsage": "Medium",
    "interests": ["Technology", "Gardening"],
    "budget": "Moderate"
  }
}
```

**Response:**
```json
{
  "userProfile": {
    "location": "California",
    "homeType": "Apartment",
    "residents": 2,
    "energyUsage": "Medium",
    "interests": ["Technology", "Gardening"],
    "budget": "Moderate"
  },
  "tips": {
    "dailyTips": [
      "Use smart power strips to eliminate phantom energy use from electronics",
      "Keep your refrigerator at optimal temperature (38°F) to save energy",
      "Use natural lighting and LED bulbs to reduce lighting energy consumption"
    ],
    "weeklyTips": [
      "Start a small balcony garden with herbs to reduce food transportation emissions",
      "Run only full loads in your dishwasher and washing machine"
    ],
    "monthlyTips": [
      "Install a smart thermostat to optimize heating and cooling schedules"
    ],
    "potentialSavings": 120,
    "solarTokens": 0.0244
  },
  "timestamp": "2025-04-23T20:45:50.789Z"
}
```

## Implementation Examples

### JavaScript Example (Frontend)

```javascript
// Energy Assistant Example
async function askEnergyAssistant(question) {
  const response = await fetch('/api/ai/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: question })
  });
  
  return await response.json();
}

// Product Analysis Example
async function analyzeProduct(productInfo) {
  const response = await fetch('/api/ai/analyze-product', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ productInfo })
  });
  
  return await response.json();
}

// Energy Tips Example
async function getPersonalizedTips(userProfile) {
  const response = await fetch('/api/ai/energy-tips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userProfile })
  });
  
  return await response.json();
}
```

### cURL Examples

```bash
# Energy Assistant
curl -X POST http://localhost:3000/api/ai/assistant \
  -H "Content-Type: application/json" \
  -d '{"query": "How much is 1 SOLAR worth?"}'

# Product Analysis
curl -X POST http://localhost:3000/api/ai/analyze-product \
  -H "Content-Type: application/json" \
  -d '{"productInfo": {"name": "Smartphone", "type": "Electronics", "materials": "Glass, aluminum, plastic", "location": "China", "weight": "0.18 kg"}}'

# Energy Tips
curl -X POST http://localhost:3000/api/ai/energy-tips \
  -H "Content-Type: application/json" \
  -d '{"userProfile": {"location": "New York", "homeType": "House", "residents": 4, "energyUsage": "High", "interests": ["Environment", "Cooking"], "budget": "Low"}}'
```

## API Status Check

You can verify if the OpenAI integration is available by checking the health endpoint:

```bash
curl http://localhost:3000/health
```

The response will include:

```json
{
  "status": "ok",
  "timestamp": "2025-04-23T20:46:10.123Z",
  "database": "connected",
  "membersCount": 16,
  "environment": "development",
  "usingCustomDbUrl": true,
  "openai": "available",
  "apiFeatures": {
    "ai": true,
    "solarClock": true,
    "members": true,
    "signup": true
  }
}
```

## Notes on Implementation

1. The OpenAI integration is server-side only - the API key is never exposed to clients
2. All API endpoints return structured JSON responses
3. Error handling is built-in, with appropriate HTTP status codes
4. The AI features focus specifically on solar energy and sustainability
5. The Current-See's specific data (start date, SOLAR value, etc.) is incorporated into AI responses