/**
 * The Current-See Pure Deployment Server
 * 
 * This is a minimal deployment server with zero dependencies on path-to-regexp.
 * It's designed to handle the CURRENTSEE_DB_URL environment variable and
 * provide OpenAI integration.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const url = require('url');

// Import OpenAI service
let openaiService;

// Check for feature state file
const OPENAI_STATE_FILE = path.join(__dirname, '.openai-feature-state.json');
let openAIFeaturesEnabled = false;

try {
  if (fs.existsSync(OPENAI_STATE_FILE)) {
    const stateData = fs.readFileSync(OPENAI_STATE_FILE, 'utf8');
    const state = JSON.parse(stateData);
    openAIFeaturesEnabled = state.apiWorking === true;
    console.log(`OpenAI features state from file: ${openAIFeaturesEnabled ? 'ENABLED' : 'DISABLED'}`);
  }
} catch (stateError) {
  console.error('Error reading OpenAI feature state file:', stateError.message);
}

try {
  if (openAIFeaturesEnabled) {
    // Check for NEW_OPENAI_API_KEY first
    if (process.env.NEW_OPENAI_API_KEY) {
      console.log('Using NEW_OPENAI_API_KEY for OpenAI integration');
    }
    
    // First try to load the regular OpenAI service if features are enabled
    try {
      openaiService = require('./openai-service');
      console.log('OpenAI service loaded successfully');
      
      // Test the OpenAI service to ensure it's working properly
      console.log('Testing OpenAI connection...');
      openaiService.getEnergyAssistantResponse('test')
        .then(response => {
          if (response && response.error) {
            console.warn('OpenAI API test received error response:', response.message);
            throw new Error('Authentication failed: ' + (response.details || 'Unknown error'));
          } else {
            console.log('✓ OpenAI API connection successful');
          }
        })
        .catch(error => {
          console.error('OpenAI API authentication error:', error.message);
          // If there's an authentication error, fallback to minimal service
          try {
            openaiService = require('./openai-service-minimal');
            console.log('Minimal OpenAI service loaded as fallback due to API authentication error');
          } catch (fallbackErr) {
            console.error('Failed to load minimal OpenAI service:', fallbackErr.message);
            openaiService = null;
          }
        });
    } catch (err) {
      console.error('Failed to load OpenAI service:', err.message);
      // Try to load the minimal version as fallback
      try {
        openaiService = require('./openai-service-minimal');
        console.log('Minimal OpenAI service loaded as fallback');
      } catch (fallbackErr) {
        console.error('Failed to load minimal OpenAI service:', fallbackErr.message);
        openaiService = null;
      }
    }
  } else {
    // If features are disabled, load minimal service in disabled mode
    try {
      openaiService = require('./openai-service-minimal');
      console.log('Minimal OpenAI service loaded (features disabled in configuration)');
    } catch (err) {
      console.error('Failed to load minimal OpenAI service:', err.message);
      openaiService = null;
    }
  }
} catch (err) {
  console.error('Error in OpenAI service initialization:', err.message);
  openaiService = null;
}

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Use 0.0.0.0 to accept connections from any IP
const PUBLIC_DIR = path.join(__dirname, 'public');

// Version information
const APP_VERSION = {
  version: '1.2.1',
  name: 'The Current-See Pure Deployment Server',
  build: '2025.04.24',
  features: {
    solarClock: true,
    database: true,
    openai: true,
    distributionSystem: true
  }
};

// Global variables
let dbPool = null;
let dbConnected = false;
let members = [];
let solarConstants = {
  startDate: new Date('2025-04-07T00:00:00Z'),
  solarValue: 136000, // $ per SOLAR
  solarToEnergy: 4913, // kWh per SOLAR
  reserveAmount: 10000000000, // 10 billion SOLAR
};

// Logger function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Database connection using CURRENTSEE_DB_URL
async function initDb() {
  log('Initializing database connection...');
  
  const dbUrl = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    log('No database URL available', true);
    return false;
  }
  
  log(`Using database URL: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
  
  try {
    dbPool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await dbPool.connect();
    log('Database connection successful!');
    
    const result = await client.query('SELECT current_database() as db, current_user as user');
    log(`Connected to database: ${result.rows[0].db} as user: ${result.rows[0].user}`);
    
    const membersResult = await client.query('SELECT COUNT(*) FROM members');
    log(`Found ${membersResult.rows[0].count} members in the database`);
    
    // Load members data
    const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
    members = allMembersResult.rows;
    log(`Loaded ${members.length} members from database`);
    
    client.release();
    dbConnected = true;
    return true;
  } catch (err) {
    log(`Database connection error: ${err.message}`, true);
    dbConnected = false;
    return false;
  }
}

// Calculate Solar Generator data
function calculateSolarData() {
  const now = new Date();
  const startDate = solarConstants.startDate;
  const diffTime = Math.abs(now - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const hourlyKwH = 27777.778; // 2/3 of a million kWh per day, distributed hourly
  const elapsedHours = Math.floor(diffTime / (1000 * 60 * 60));
  
  // Calculate total energy
  const totalEnergyKwH = elapsedHours * hourlyKwH;
  
  // Format as MkWh with 6 decimal places
  const totalEnergyMkWh = (totalEnergyKwH / 1000000).toFixed(6);
  
  // Calculate monetary value
  const totalValue = ((totalEnergyKwH / solarConstants.solarToEnergy) * solarConstants.solarValue).toFixed(2);
  
  return {
    daysRunning: diffDays,
    hoursRunning: elapsedHours,
    totalEnergy: totalEnergyMkWh,
    totalValue: totalValue
  };
}

// MIME types for static files
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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
          resolve(JSON.parse(body));
        } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(body);
          const result = {};
          for (const [key, value] of params) {
            result[key] = value;
          }
          resolve(result);
        } else {
          resolve(body);
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Serve static file
function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try serving index.html for SPA routes
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(indexPath, (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(indexData);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Handle API routes
  if (pathname === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: APP_VERSION.version,
      build: APP_VERSION.build,
      name: APP_VERSION.name,
      database: dbConnected ? 'connected' : 'disconnected',
      membersCount: members.length,
      environment: process.env.NODE_ENV || 'development',
      usingCustomDbUrl: !!process.env.CURRENTSEE_DB_URL,
      openai: openaiService ? 'available' : 'unavailable',
      apiFeatures: {
        ai: openaiService ? true : false,
        solarClock: true,
        members: true,
        signup: dbConnected
      }
    }));
    return;
  }
  
  if (pathname === '/api/version') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      version: APP_VERSION.version,
      build: APP_VERSION.build,
      name: APP_VERSION.name,
      features: APP_VERSION.features,
      openaiEnabled: openaiService ? (openaiService.isApiWorking ? openaiService.isApiWorking() : false) : false,
      dbConnected: dbConnected,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (pathname === '/api/database/status') {
    try {
      if (!dbPool) {
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          status: 'error',
          connected: false,
          message: 'Database connection not initialized'
        }));
        return;
      }
      
      const client = await dbPool.connect();
      const result = await client.query('SELECT NOW() as time');
      const membersResult = await client.query('SELECT COUNT(*) FROM members');
      client.release();
      
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        status: 'ok',
        connected: true,
        timestamp: result.rows[0].time,
        membersCount: parseInt(membersResult.rows[0].count),
        environmentType: process.env.NODE_ENV || 'development',
        usingCustomDbUrl: !!process.env.CURRENTSEE_DB_URL
      }));
    } catch (err) {
      log(`Database status check error: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        status: 'error',
        connected: false,
        message: err.message
      }));
    }
    return;
  }
  
  if (pathname === '/api/solar-clock') {
    const solarData = calculateSolarData();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(solarData));
    return;
  }
  
  // Serve embedded members file as JSON (this endpoint was missing)
  if (pathname === '/embedded-members') {
    try {
      if (members.length === 0 && dbConnected) {
        // Try to reload members from database
        try {
          const client = await dbPool.connect();
          const result = await client.query('SELECT * FROM members ORDER BY id ASC');
          members = result.rows;
          client.release();
          log(`Reloaded ${members.length} members from database for embedded-members request`);
        } catch (err) {
          log(`Error reloading members for embedded-members: ${err.message}`, true);
        }
      }
      
      // Map to public fields only, same as /api/members endpoint
      const publicMembers = members.map(member => ({
        id: member.id,
        name: member.name,
        username: member.username || `member${member.id}`,
        joinedDate: member.joined_date,
        totalSolar: member.total_solar,
        totalDollars: member.total_dollars || (member.total_solar * 136000),
        isAnonymous: member.is_anonymous || false,
        isReserve: member.is_reserve || (member.name && member.name.toLowerCase().includes('reserve')),
        lastDistributionDate: member.last_distribution_date || new Date().toISOString().split('T')[0]
      }));
      
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(publicMembers));
    } catch (err) {
      log(`Error serving /embedded-members: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        error: 'Server error',
        message: err.message
      }));
    }
    return;
  }
  
  if (pathname === '/api/members') {
    try {
      if (members.length === 0 && dbConnected) {
        // Try to reload members from database
        try {
          const client = await dbPool.connect();
          const result = await client.query('SELECT * FROM members ORDER BY id ASC');
          members = result.rows;
          client.release();
          log(`Reloaded ${members.length} members from database`);
        } catch (err) {
          log(`Error reloading members: ${err.message}`, true);
        }
      }
      
      // Map to public fields with more detailed information to match client expectations
      const publicMembers = members.map(member => ({
        id: member.id,
        name: member.name,
        username: member.username || `member${member.id}`,
        joinedDate: member.joined_date,
        totalSolar: member.total_solar,
        totalDollars: member.total_dollars || (member.total_solar * 136000),
        isAnonymous: member.is_anonymous || false,
        isReserve: member.is_reserve || (member.name && member.name.toLowerCase().includes('reserve')),
        lastDistributionDate: member.last_distribution_date || new Date().toISOString().split('T')[0]
      }));
      
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(publicMembers));
    } catch (err) {
      log(`Error serving /api/members: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        error: 'Server error',
        message: err.message
      }));
    }
    return;
  }
  
  // Check if path starts with /api/member/ (single member API)
  if (pathname.startsWith('/api/member/')) {
    const idStr = pathname.split('/')[3];
    const memberId = parseInt(idStr);
    
    if (isNaN(memberId)) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Invalid member ID' }));
      return;
    }
    
    try {
      if (dbConnected) {
        const client = await dbPool.connect();
        const result = await client.query('SELECT * FROM members WHERE id = $1', [memberId]);
        client.release();
        
        if (result.rows.length === 0) {
          res.writeHead(404, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ error: 'Member not found' }));
          return;
        }
        
        const member = result.rows[0];
        
        // Format member data to match client-side expected format
        const formattedMember = {
          id: member.id,
          name: member.name,
          username: member.username || `member${member.id}`,
          joinedDate: member.joined_date,
          totalSolar: member.total_solar,
          totalDollars: member.total_dollars || (member.total_solar * 136000),
          isAnonymous: member.is_anonymous || false,
          isReserve: member.is_reserve || (member.name && member.name.toLowerCase().includes('reserve')),
          lastDistributionDate: member.last_distribution_date || new Date().toISOString().split('T')[0]
        };
        
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(formattedMember));
      } else {
        // Fallback to memory
        const member = members.find(m => m.id === memberId);
        
        if (!member) {
          res.writeHead(404, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ error: 'Member not found' }));
          return;
        }
        
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          id: member.id,
          name: member.name,
          username: member.username || `member${member.id}`,
          joinedDate: member.joined_date,
          totalSolar: member.total_solar,
          totalDollars: member.total_dollars || (member.total_solar * 136000),
          isAnonymous: member.is_anonymous || false,
          isReserve: member.is_reserve || (member.name && member.name.toLowerCase().includes('reserve')),
          lastDistributionDate: member.last_distribution_date || new Date().toISOString().split('T')[0]
        }));
      }
    } catch (err) {
      log(`Error fetching member ${memberId}: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Server error', message: err.message }));
    }
    return;
  }
  
  // OpenAI Energy Assistant Endpoint
  if (pathname === '/api/ai/assistant' && req.method === 'POST') {
    try {
      if (!openaiService) {
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ 
          error: 'OpenAI service unavailable',
          message: 'The AI assistant is currently unavailable. Please try again later.'
        }));
        return;
      }

      const body = await parseBody(req);
      const query = body.query || '';
      
      if (!query) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Query is required' }));
        return;
      }
      
      log(`Processing AI assistant query: "${query.substring(0, 30)}..."`);
      const response = await openaiService.getEnergyAssistantResponse(query);
      
      // Check if the response is an error response
      if (response && response.error === true) {
        // This is an error response, return as 503 Service Unavailable
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          query: query,
          response: response,
          timestamp: new Date().toISOString()
        }));
      } else {
        // This is a successful response
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          query: query,
          response: response,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      log(`Error in AI assistant: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ 
        error: 'Server error',
        message: err.message
      }));
    }
    return;
  }
  
  // OpenAI Product Energy Analysis Endpoint
  if (pathname === '/api/ai/analyze-product' && req.method === 'POST') {
    try {
      if (!openaiService) {
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ 
          error: 'OpenAI service unavailable',
          message: 'The AI product analysis service is currently unavailable.'
        }));
        return;
      }

      const body = await parseBody(req);
      const productInfo = body.productInfo || {};
      
      if (!productInfo.name) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Product name is required' }));
        return;
      }
      
      log(`Analyzing product: "${productInfo.name}"`);
      const analysis = await openaiService.analyzeProductEnergy(productInfo);
      
      // Check if the response is an error response
      if (analysis && analysis.error === true) {
        // This is an error response, return as 503 Service Unavailable
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          productInfo: productInfo,
          analysis: analysis,
          timestamp: new Date().toISOString()
        }));
      } else {
        // This is a successful response
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          productInfo: productInfo,
          analysis: analysis,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      log(`Error in product analysis: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ 
        error: 'Server error',
        message: err.message
      }));
    }
    return;
  }
  
  // OpenAI Personalized Energy Tips Endpoint
  if (pathname === '/api/ai/energy-tips' && req.method === 'POST') {
    try {
      if (!openaiService) {
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ 
          error: 'OpenAI service unavailable',
          message: 'The AI energy tips service is currently unavailable.'
        }));
        return;
      }

      const body = await parseBody(req);
      const userProfile = body.userProfile || {};
      
      log(`Generating energy tips for user`);
      const tips = await openaiService.getPersonalizedEnergyTips(userProfile);
      
      // Check if the response is an error response
      if (tips && tips.error === true) {
        // This is an error response, return as 503 Service Unavailable
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          userProfile: userProfile,
          tips: tips,
          timestamp: new Date().toISOString()
        }));
      } else {
        // This is a successful response
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          userProfile: userProfile,
          tips: tips,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      log(`Error generating energy tips: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ 
        error: 'Server error',
        message: err.message
      }));
    }
    return;
  }
  
  if (pathname === '/api/signup' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const name = body.name;
      const email = body.email;
      
      if (!name || !email) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Name and email are required' }));
        return;
      }
      
      if (!dbConnected || !dbPool) {
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Database service unavailable' }));
        return;
      }
      
      const client = await dbPool.connect();
      
      // Check if email already exists
      const existingResult = await client.query('SELECT id FROM members WHERE email = $1', [email]);
      
      if (existingResult.rows.length > 0) {
        client.release();
        res.writeHead(409, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'This email is already registered' }));
        return;
      }
      
      // Create new member
      const today = new Date().toISOString().split('T')[0];
      const result = await client.query(`
        INSERT INTO members (name, email, joined_date, total_solar)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, joined_date, total_solar
      `, [name, email, today, 1]);
      
      // Reload members
      const allMembersResult = await client.query('SELECT * FROM members ORDER BY id ASC');
      members = allMembersResult.rows;
      
      client.release();
      
      res.writeHead(201, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(result.rows[0]));
    } catch (err) {
      log(`Signup error: ${err.message}`, true);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Server error', message: err.message }));
    }
    return;
  }
  
  // Serve static files
  const filePath = pathname === '/' 
    ? path.join(PUBLIC_DIR, 'index.html') 
    : path.join(PUBLIC_DIR, pathname);
    
  serveStaticFile(res, filePath);
});

// Start server
server.listen(PORT, HOST, async () => {
  log(`=== ${APP_VERSION.name} v${APP_VERSION.version} (Build ${APP_VERSION.build}) ===`);
  log(`Server running on http://${HOST}:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`Using custom database URL: ${!!process.env.CURRENTSEE_DB_URL}`);
  
  // Log OpenAI status
  if (openaiService) {
    const isEnabled = openaiService.isApiWorking ? openaiService.isApiWorking() : false;
    log(`OpenAI integration: ${isEnabled ? 'ENABLED' : 'DISABLED (fallback mode)'}`);
  } else {
    log('OpenAI integration: NOT AVAILABLE', true);
  }
  
  // Initialize database
  await initDb();
  
  // Log solar data
  const solarData = calculateSolarData();
  log('Solar Generator initialized:');
  log(`- Days running: ${solarData.daysRunning}`);
  log(`- Total energy: ${solarData.totalEnergy} MkWh`);
  log(`- Total value: $${solarData.totalValue}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  server.close(() => {
    log('Server closed');
    if (dbPool) {
      dbPool.end()
        .then(() => log('Database pool closed'))
        .catch(err => log(`Error closing db pool: ${err.message}`, true))
        .finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  server.close(() => {
    log('Server closed');
    if (dbPool) {
      dbPool.end()
        .then(() => log('Database pool closed'))
        .catch(err => log(`Error closing db pool: ${err.message}`, true))
        .finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
});