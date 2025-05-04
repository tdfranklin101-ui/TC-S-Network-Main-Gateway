/**
 * The Current-See Deployment Server
 * 
 * This is the main entry point for the Replit deployment.
 * It configures a simple Express server to serve static files
 * and handle health checks for the deployment environment.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const schedule = require('node-schedule');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.CURRENTSEE_DB_URL || process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

// Configure the app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global variables
let members = [];
let totalEnergy = 0;
let totalDollars = 0;
let dbPool = null;

// Database initialization
function initializeDatabase() {
  try {
    if (DATABASE_URL) {
      console.log('Initializing database connection...');
      dbPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      // Test the connection
      dbPool.query('SELECT NOW()', (err, res) => {
        if (err) {
          console.error('Database connection error:', err.message);
          loadMembersFromFiles();
        } else {
          console.log('Database connected successfully');
          loadMembersFromDatabase();
        }
      });
    } else {
      console.log('No database URL provided, using file-based storage');
      loadMembersFromFiles();
    }
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    loadMembersFromFiles();
  }
}

// Load members from database
async function loadMembersFromDatabase() {
  try {
    const result = await dbPool.query('SELECT * FROM members ORDER BY id');
    members = result.rows.map(member => ({
      ...member,
      totalSolar: parseFloat(member.total_solar || 0),
      totalDollars: parseFloat(member.total_dollars || 0),
      joinedDate: member.joined_date ? new Date(member.joined_date).toISOString().split('T')[0] : null,
      lastDistributionDate: member.last_distribution_date ? new Date(member.last_distribution_date).toISOString().split('T')[0] : null
    }));
    
    console.log(`Loaded ${members.length} members from database`);
    calculateTotals();
    updateMembersFile();
    
    // Schedule distributions
    setupDistributions();
  } catch (error) {
    console.error('Error loading members from database:', error.message);
    loadMembersFromFiles();
  }
}

// Load members from files as fallback
function loadMembersFromFiles() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'public/api/members.json'), 'utf8');
    members = JSON.parse(data);
    console.log(`Loaded ${members.length} members from file`);
    calculateTotals();
    
    // Schedule distributions
    setupDistributions();
  } catch (error) {
    console.error('Error loading members from file:', error.message);
    members = [];
  }
}

// Calculate total energy and dollars
function calculateTotals() {
  totalEnergy = 0;
  totalDollars = 0;
  
  for (const member of members) {
    totalEnergy += member.totalSolar * 4913; // 4,913 kWh per SOLAR
    totalDollars += member.totalSolar * 136000; // $136,000 per SOLAR
  }
  
  console.log(`Total energy: ${totalEnergy.toFixed(6)} kWh`);
  console.log(`Total dollars: $${totalDollars.toFixed(2)}`);
}

// Update members file
function updateMembersFile() {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'public/api/members.json'),
      JSON.stringify(members, null, 2)
    );
    console.log('Members file updated');
  } catch (error) {
    console.error('Error updating members file:', error.message);
  }
}

// Setup daily distributions
function setupDistributions() {
  // Schedule daily distribution at 00:00 GMT (midnight UTC)
  schedule.scheduleJob('0 0 * * *', async () => {
    console.log('Running scheduled distribution at 00:00 GMT');
    await processDailyDistribution();
  });
  
  console.log('Daily distribution scheduled for 00:00 GMT');
}

// Process daily distribution
async function processDailyDistribution() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    console.log(`Processing daily distribution for ${today}`);
    let distributionCount = 0;
    
    // Process each member
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      
      // Skip reserves or members who already received today's distribution
      if (member.isReserve || member.lastDistributionDate === today) {
        continue;
      }
      
      // Add 1 SOLAR per day
      member.totalSolar += 1;
      member.totalDollars = member.totalSolar * 136000;
      member.lastDistributionDate = today;
      distributionCount++;
      
      // Update database if available
      if (dbPool) {
        try {
          await dbPool.query(
            'UPDATE members SET total_solar = $1, total_dollars = $2, last_distribution_date = $3 WHERE id = $4',
            [member.totalSolar, member.totalDollars, today, member.id]
          );
        } catch (dbError) {
          console.error(`Database update error for member ${member.id}:`, dbError.message);
        }
      }
    }
    
    console.log(`Distributed 1 SOLAR to ${distributionCount} members`);
    calculateTotals();
    updateMembersFile();
  } catch (error) {
    console.error('Error processing daily distribution:', error.message);
  }
}

// API Routes

// Health check endpoint
app.get(['/', '/health', '/healthz'], (req, res) => {
  res.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.2.1'
  });
});

// Get total energy and dollars
app.get('/api/totals', (req, res) => {
  res.json({
    totalEnergy: totalEnergy,
    totalDollars: totalDollars,
    formattedEnergy: (totalEnergy / 1000000).toFixed(6),
    formattedDollars: totalDollars.toFixed(2)
  });
});

// Get members list
app.get('/api/members', (req, res) => {
  res.json(members);
});

// Get embedded members (for iframe embedding)
app.get('/embedded-members', (req, res) => {
  fs.readFile(path.join(__dirname, 'public/embedded-members.html'), 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error loading embedded members page');
    }
    res.send(data);
  });
});

// AI Assistant API endpoint
app.post('/api/ai-assistant', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        message: 'The AI assistant is currently unavailable. Please try again later.'
      });
    }
    
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Forward to your OpenAI service
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant for The Current-See, a renewable energy and sustainable finance platform. You help users understand their solar energy investments, explain the Current-See system of distributing SOLAR tokens (each worth 4,913 kWh or $136,000), and provide guidance on sustainable living. Be friendly, informative, and focus on explaining complex energy and financial concepts in simple terms."
          },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const response = completion.choices[0].message.content;
      
      res.json({
        response: response,
        source: 'openai'
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError.message);
      
      // Fallback to a simple response if OpenAI fails
      res.json({
        response: "I'm sorry, I couldn't process your request at the moment. Please try again later.",
        source: 'fallback'
      });
    }
  } catch (error) {
    console.error('AI Assistant error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes (token-protected)
app.use('/api/admin', (req, res, next) => {
  const token = req.headers['x-api-token'];
  
  if (token !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
});

// Force a distribution (admin only)
app.post('/api/admin/distribute', async (req, res) => {
  try {
    await processDailyDistribution();
    res.json({ success: true, message: 'Distribution processed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  initializeDatabase();
});