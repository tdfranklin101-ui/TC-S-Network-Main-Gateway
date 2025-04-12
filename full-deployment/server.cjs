/**
 * The Current-See Main Application Server (CommonJS Version)
 * This file handles both the health checks and serves the static website
 */

// CommonJS imports
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL;

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection (if available)
let pool = null;
try {
  if (DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('Database connection initialized');
  } else {
    console.log('No DATABASE_URL provided, running in memory mode');
  }
} catch (err) {
  console.error('Database connection error:', err);
}

// In-memory storage fallback
const memoryStorage = {
  users: [],
  solarAccounts: [],
  distributions: [],
  solarClock: [],
  registrants: []
};

// Health check routes (high priority)
app.get(['/', '/health', '/healthz', '/_health'], (req, res) => {
  console.log(`[HEALTH] ${req.method} ${req.url} (${req.headers['user-agent'] || 'unknown'})`);
  res.status(200).send('OK');
});

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.get('/api/member-count', async (req, res) => {
  try {
    let count = 0;
    if (pool) {
      const result = await pool.query('SELECT COUNT(*) FROM registrants');
      count = parseInt(result.rows[0].count);
    } else {
      count = memoryStorage.registrants.length;
    }
    res.json({ count });
  } catch (err) {
    console.error('Error getting member count:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    let result;
    if (pool) {
      // Check if email already exists
      const checkResult = await pool.query('SELECT * FROM registrants WHERE email = $1', [email]);
      if (checkResult.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // Insert new registrant
      result = await pool.query(
        'INSERT INTO registrants (name, email, registration_date) VALUES ($1, $2, NOW()) RETURNING *',
        [name, email]
      );
    } else {
      // In-memory fallback
      if (memoryStorage.registrants.find(r => r.email === email)) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      const newRegistrant = {
        id: memoryStorage.registrants.length + 1,
        name,
        email,
        registration_date: new Date().toISOString()
      };
      
      memoryStorage.registrants.push(newRegistrant);
      result = { rows: [newRegistrant] };
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/solar-accounts/leaderboard', async (req, res) => {
  try {
    let members = [];
    
    if (pool) {
      const result = await pool.query(`
        SELECT u.id, u.username, u.name, u.join_date, sa.balance 
        FROM users u
        LEFT JOIN solar_accounts sa ON u.id = sa.user_id
        ORDER BY u.id ASC
        LIMIT 10
      `);
      members = result.rows;
    } else {
      // Fallback with default data
      members = [{
        id: 1,
        username: "terry",
        name: "Terry D. Franklin",
        join_date: "2025-04-10T00:00:00.000Z",
        balance: 1
      }];
    }
    
    res.json(members);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Solar clock data API
app.get('/api/solar-clock', async (req, res) => {
  try {
    let data;
    
    if (pool) {
      const result = await pool.query('SELECT * FROM solar_clock ORDER BY timestamp DESC LIMIT 1');
      data = result.rows[0];
    } else {
      // Fallback with reasonable data
      data = {
        timestamp: new Date().toISOString(),
        kwh_accumulated: 4176000000000, // Placeholder value
        monetary_value: 136000 // Placeholder value
      };
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching solar clock data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
});

// Keep the process running
process.on('uncaughtException', (err) => {
  console.error(`Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});