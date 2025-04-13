// Simple standalone server for deployment - NO ESM syntax, pure CommonJS
const http = require('http');
const fs = require('fs');
const path = require('path');

// Constants
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Solar Constants (mirrored from server/solar-constants.ts)
const SOLAR_CONSTANTS = {
  TOTAL_SOLAR_KWH_PER_DAY: 4.176e+15,  // Total solar energy hitting Earth daily in kWh
  MONETIZED_PERCENTAGE: 0.01,          // 1% of total solar energy is monetized
  GLOBAL_POPULATION: 8.5e+9,           // Global population estimate
  TEST_GROUP_POPULATION: 1000,         // Initial test group size
  USD_PER_SOLAR: 136000,               // Value of 1 SOLAR unit in USD
  
  // Calculated values (these will be computed in init)
  monetizedKwh: 0,
  solarPerPersonKwh: 0,
  mkwhPerDay: 0,
  KWH_PER_SECOND: 0,
  DAILY_SOLAR_DISTRIBUTION: 1, // 1 SOLAR per day per person
  DAILY_KWH_DISTRIBUTION: 0,
  DAILY_USD_DISTRIBUTION: 0
};

// Initialize calculated solar values
function initSolarConstants() {
  SOLAR_CONSTANTS.monetizedKwh = SOLAR_CONSTANTS.TOTAL_SOLAR_KWH_PER_DAY * SOLAR_CONSTANTS.MONETIZED_PERCENTAGE;
  SOLAR_CONSTANTS.solarPerPersonKwh = SOLAR_CONSTANTS.monetizedKwh / SOLAR_CONSTANTS.GLOBAL_POPULATION;
  SOLAR_CONSTANTS.mkwhPerDay = SOLAR_CONSTANTS.monetizedKwh / 1e6;
  SOLAR_CONSTANTS.KWH_PER_SECOND = SOLAR_CONSTANTS.mkwhPerDay * 1e6 / (24 * 60 * 60);
  SOLAR_CONSTANTS.DAILY_KWH_DISTRIBUTION = SOLAR_CONSTANTS.solarPerPersonKwh;
  SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION = SOLAR_CONSTANTS.DAILY_SOLAR_DISTRIBUTION * SOLAR_CONSTANTS.USD_PER_SOLAR;
}

// Initialize solar constants
initSolarConstants();

// Base date for solar clock calculations
const SOLAR_CLOCK_BASE_DATE = new Date('2025-04-07T00:00:00Z');

// Initialize solar clock data
const solarClockData = {
  timestamp: new Date().toISOString(),
  elapsedSeconds: (Date.now() - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000,
  totalKwh: 0,  // This will be calculated
  totalDollars: 0,  // This will be calculated
  kwhPerSecond: SOLAR_CONSTANTS.KWH_PER_SECOND,
  dollarPerKwh: SOLAR_CONSTANTS.USD_PER_SOLAR / (SOLAR_CONSTANTS.solarPerPersonKwh * 365),
  dailyKwh: SOLAR_CONSTANTS.monetizedKwh,
  dailyDollars: SOLAR_CONSTANTS.DAILY_USD_DISTRIBUTION * SOLAR_CONSTANTS.GLOBAL_POPULATION
};

// Calculate initial solar clock values
function initSolarClockData() {
  const now = Date.now();
  solarClockData.timestamp = new Date().toISOString();
  solarClockData.elapsedSeconds = (now - SOLAR_CLOCK_BASE_DATE.getTime()) / 1000;
  solarClockData.totalKwh = solarClockData.elapsedSeconds * SOLAR_CONSTANTS.KWH_PER_SECOND;
  solarClockData.totalDollars = solarClockData.totalKwh * solarClockData.dollarPerKwh;
}

// Initialize solar clock data
initSolarClockData();

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  
  // Health check endpoints
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/health-check') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  
  // Solar clock API endpoint
  if (req.url === '/api/solar-clock') {
    // Update the timestamp and calculations to ensure fresh data
    initSolarClockData();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(solarClockData));
  }
  
  // Users and registrants API endpoint - simplified read-only version with static data
  if (req.url === '/api/users' || req.url === '/api/registrants') {
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
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(users));
  }
  
  // Normalize the URL
  let url = req.url;
  
  // Handle root path
  if (url === '/') {
    url = '/index.html';
  }
  
  // Remove query parameters
  url = url.split('?')[0];
  
  // Build the file path
  const filePath = path.join(__dirname, 'public', url);
  const extname = path.extname(filePath).toLowerCase();
  
  // Check if the file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // File not found, try to serve index.html
      if (url !== '/index.html') {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        fs.stat(indexPath, (err, stats) => {
          if (err || !stats.isFile()) {
            // If index.html not found, return 200 OK with a simple message
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end('<html><body><h1>The Current-See</h1><p>Welcome to the service.</p></body></html>');
          } else {
            // Serve index.html instead
            fs.readFile(indexPath, (err, content) => {
              if (err) {
                res.writeHead(500);
                return res.end('Server Error');
              }
              res.writeHead(200, { 'Content-Type': 'text/html' });
              return res.end(content);
            });
          }
        });
      } else {
        // If index.html was requested but not found
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<html><body><h1>The Current-See</h1><p>Welcome to the service.</p></body></html>');
      }
      return;
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      
      // Get content type
      const contentType = MIME_TYPES[extname] || 'text/plain';
      
      // Send the response
      res.writeHead(200, { 'Content-Type': contentType });
      return res.end(content);
    });
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

// Handle server errors
server.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
});