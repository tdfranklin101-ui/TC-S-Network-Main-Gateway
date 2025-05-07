/**
 * The Current-See Deployment Server
 * 
 * This server is designed to handle Replit deployments with proper
 * health checks and port configuration.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();

// Set port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Special health check endpoint for Replit
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Root health check endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404s
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Current-See server running on port ${PORT}`);
  console.log(`Health check responding at / and /healthz`);
});