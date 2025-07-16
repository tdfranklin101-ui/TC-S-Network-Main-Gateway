/**
 * The Current-See - Ultra-Reliable Deployment Server
 * Specifically designed for Replit deployments
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Health check - required for Replit deployments
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT 
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Private network route
app.get('/private-network', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'private-network.html'));
});

// QA meaning purpose route  
app.get('/qa-meaning-purpose', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qa-meaning-purpose.html'));
});

// Other essential routes
app.get('/wallet.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet.html'));
});

app.get('/declaration.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'declaration.html'));
});

app.get('/founder_note.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'founder_note.html'));
});

app.get('/whitepapers.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whitepapers.html'));
});

app.get('/business_plan.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business_plan.html'));
});

// Members API
app.get('/api/members', (req, res) => {
  try {
    const membersPath = path.join(__dirname, 'public', 'api', 'members.json');
    if (fs.existsSync(membersPath)) {
      const members = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
      res.json(members);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Unable to load members' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See server running on port ${PORT}`);
  console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🌐 Website: http://0.0.0.0:${PORT}/`);
});