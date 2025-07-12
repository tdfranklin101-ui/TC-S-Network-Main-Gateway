/**
 * Simple Deployment Server for The Current-See
 * 
 * This server is designed to work reliably in deployment environments
 * with proper health checks and port configuration.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint - health check for deployment
app.get('/', (req, res) => {
  // For deployment health checks (no user agent)
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  
  // For browsers, serve the main page
  try {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send(`
        <html>
          <head><title>The Current-See</title></head>
          <body>
            <h1>The Current-See</h1>
            <p>Solar-backed universal basic income platform</p>
            <p>Server running on port ${PORT}</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', port: PORT });
});

app.get('/api/members', (req, res) => {
  try {
    const membersPath = path.join(PUBLIC_DIR, 'api', 'members.json');
    if (fs.existsSync(membersPath)) {
      const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
      res.json(members);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load members' });
  }
});

app.get('/api/solar-clock', (req, res) => {
  const startDate = new Date('2025-04-07T00:00:00Z');
  const now = new Date();
  const elapsed = (now - startDate) / 1000; // seconds
  const elapsedHours = elapsed / 3600;
  
  // Simple energy calculation
  const totalEnergy = elapsedHours * 27748140000 * 0.01; // Simplified
  const totalEnergyMkwh = totalEnergy / 1000000;
  
  res.json({
    totalEnergyMkwh: totalEnergyMkwh.toFixed(6),
    totalValue: (totalEnergyMkwh * 1000000 / 4913 * 136000).toFixed(2),
    elapsedHours: elapsedHours.toFixed(2),
    timestamp: now.toISOString()
  });
});

// Serve static files
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));

// Catch-all handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] The Current-See deployment server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});