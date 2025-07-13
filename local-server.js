const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Solar clock API
app.get('/api/solar-clock', (req, res) => {
  const startDate = new Date('2025-04-07T00:00:00Z');
  const now = new Date();
  const elapsedSeconds = (now - startDate) / 1000;
  const elapsedHours = elapsedSeconds / 3600;
  
  // Solar calculations
  const totalPowerPerHour = 1.366 * 510100000 * 1000000 * 0.20 * 0.01;
  const totalEnergyKwh = totalPowerPerHour * elapsedHours;
  const totalEnergyMkwh = totalEnergyKwh / 1000000;
  const totalValue = totalEnergyKwh / 4913 * 136000;
  
  res.json({
    totalEnergyMkwh: totalEnergyMkwh.toFixed(6),
    totalValue: totalValue.toFixed(2),
    elapsedHours: elapsedHours.toFixed(2),
    elapsedDays: (elapsedHours / 24).toFixed(1),
    timestamp: now.toISOString()
  });
});

// Members API
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
    console.error('Error loading members:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  try {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.send(`
        <html>
          <head><title>The Current-See</title></head>
          <body>
            <h1>The Current-See</h1>
            <p>Solar-backed universal basic income platform</p>
            <p>Server running locally on port ${PORT}</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Static files
app.use(express.static(PUBLIC_DIR));

// Start server
app.listen(PORT, () => {
  console.log(`The Current-See local server running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});