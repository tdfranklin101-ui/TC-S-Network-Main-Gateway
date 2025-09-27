const express = require('express');
const path = require('path');
const fs = require('fs');
const serveStatic = require('serve-static');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Simple logging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Root path for deployments
app.get('/', (req, res, next) => {
  // Check if this is a health check or a real user
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  
  // If it's a real user, serve index.html
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  next();
});

// Serve static files
app.use(serveStatic(PUBLIC_DIR));

// Start the server
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});