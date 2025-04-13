// Pure Node.js server for Replit Cloud Run deployment
// This file has NO external dependencies and uses only built-in Node.js modules
const http = require('http');
const fs = require('fs');
const path = require('path');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Solar Constants
const SOLAR_CONSTANTS = {
  TOTAL_SOLAR_KWH_PER_DAY: 4.176e+15,
  MONETIZED_PERCENTAGE: 0.01,
  GLOBAL_POPULATION: 8.5e+9,
  TEST_GROUP_POPULATION: 1000,
  USD_PER_SOLAR: 136000,
  monetizedKwh: 0,
  solarPerPersonKwh: 0,
  mkwhPerDay: 0,
  KWH_PER_SECOND: 0,
  DAILY_SOLAR_DISTRIBUTION: 1,
  DAILY_KWH_DISTRIBUTION: 0,
  DAILY_USD_DISTRIBUTION: 0
};

// Initialize solar constants
SOLAR_CONSTANTS.monetizedKwh = SOLAR_CONSTANTS.TOTAL_SOLAR_KWH_PER_DAY * SOLAR_CONSTANTS.MONETIZED_PERCENTAGE;
SOLAR_CONSTANTS.solarPerPersonKwh = SOLAR_CONSTANTS.monetizedKwh / SOLAR_CONSTANTS.GLOBAL_POPULATION;
SOLAR_CONSTANTS.mkwhPerDay = SOLAR_CONSTANTS.monetizedKwh / 1e6;
SOLAR_CONSTANTS.KWH_PER_SECOND = SOLAR_CONSTANTS.mkwhPerDay * 1e6 / (24 * 60 * 60);
SOLAR_CONSTANTS.DAILY_KWH_DISTRIBUTION = SOLAR_CONSTANTS.solarPerPersonKwh;
SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION = SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * SOLAR_CONSTANTS.USD_PER_SOLAR;

// Solar clock base date
const SOLAR_CLOCK_BASE_DATE = new Date('2025-04-07T00:00:00Z');

// Solar clock data
const solarClockData = {
  timestamp: new Date().toISOString(),
  elapsedSeconds: (Date.now() - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000,
  totalKwh: 0,
  totalDollars: 0,
  kwhPerSecond: SOLAR_CONSTANTS.KWH_PER_SECOND,
  dollarPerKwh: SOLAR_CONSTANTS.USD_PER_SOLAR / (SOLAR_CONSTANTS.solarPerPersonKwh * 365),
  dailyKwh: SOLAR_CONSTANTS.monetizedKwh,
  dailyDollars: SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION * SOLAR_CONSTANTS.GLOBAL_POPULATION
};

// Update solar clock data
function updateSolarClockData() {
  const now = Date.now();
  solarClockData.timestamp = new Date().toISOString();
  solarClockData.elapsedSeconds = (now - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000;
  solarClockData.totalKwh = solarClockData.elapsedSeconds * SOLAR_CONSTANTS.KWH_PER_SECOND;
  solarClockData.totalDollars = solarClockData.totalKwh * solarClockData.dollarPerKwh;
}

// Initial update
updateSolarClockData();

// Static user data
const users = [
  {
    id: 1,
    username: 'terry.franklin',
    firstName: 'Terry',
    lastName: 'Franklin',
    email: 'hello@thecurrentsee.org',
    joinedDate: '2025-04-10',
    totalSolar: 1,
    isAnonymous: false
  }
];

// Basic HTML response
const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Current-See</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #ffeb99, #96c93d);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    h1 {
      color: #333;
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    p {
      color: #555;
      font-size: 1.2rem;
      margin-bottom: 20px;
      max-width: 800px;
    }
    .counter {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 800px;
    }
    .counter-value {
      font-size: 2rem;
      font-weight: bold;
      color: #009900;
      margin: 10px 0;
    }
    .counter-label {
      font-size: 1rem;
      color: #666;
    }
    .founder {
      margin-top: 40px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>The Current-See: Solar Generator</h1>
  <p>Prototype of a solar-backed global economic system</p>
  
  <div class="counter">
    <div class="counter-label">Solar Energy Generated Since April 7, 2025</div>
    <div id="energy-counter" class="counter-value">Calculating...</div>
    <div class="counter-label">Million kWh (MkWh)</div>
  </div>
  
  <div class="counter">
    <div class="counter-label">Equivalent Monetary Value</div>
    <div id="money-counter" class="counter-value">Calculating...</div>
    <div class="counter-label">USD</div>
  </div>
  
  <p class="founder">Member #1: Terry D. Franklin - Joined April 10, 2025</p>

  <script>
    function updateCounters() {
      fetch('/api/solar-clock')
        .then(response => response.json())
        .then(data => {
          document.getElementById('energy-counter').textContent = 
            (data.totalKwh / 1000000).toFixed(6);
          document.getElementById('money-counter').textContent = 
            '$' + Math.floor(data.totalDollars).toLocaleString();
        })
        .catch(error => {
          console.error('Error fetching solar data:', error);
        });
    }
    
    // Update immediately and then every second
    updateCounters();
    setInterval(updateCounters, 1000);
  </script>
</body>
</html>
`;

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Handle different routes
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlResponse);
  }
  else if (req.url === '/api/solar-clock') {
    updateSolarClockData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(solarClockData));
  }
  else if (req.url === '/api/users' || req.url === '/api/registrants') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
  }
  else if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }
  else {
    // For any other path, return a 200 OK (for health checks)
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('The Current-See service is running');
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

// Handle errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
