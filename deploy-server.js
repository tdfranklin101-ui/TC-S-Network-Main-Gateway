/**
 * The Current-See Deployment-Ready Server
 * 
 * This file is specifically designed for Replit deployments
 * with minimal dependencies and maximum reliability.
 */

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
const CURRENTSEE_DB_URL = process.env.CURRENTSEE_DB_URL;

// Create Express app
const app = express();

// Basic configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple middleware for page includes
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string') {
      // Process header includes
      if (body.includes('<!-- HEADER_PLACEHOLDER -->')) {
        try {
          const headerPath = path.join(__dirname, 'public/includes/header.html');
          const header = fs.readFileSync(headerPath, 'utf8');
          body = body.replace('<!-- HEADER_PLACEHOLDER -->', header);
        } catch (err) {
          console.error('Error including header:', err);
        }
      }
      
      // Process footer includes
      if (body.includes('<!-- FOOTER_PLACEHOLDER -->')) {
        try {
          const footerPath = path.join(__dirname, 'public/includes/footer.html');
          const footer = fs.readFileSync(footerPath, 'utf8');
          body = body.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
        } catch (err) {
          console.error('Error including footer:', err);
        }
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Static files
app.use(express.static('public'));

// Health check routes (high priority)
app.get(['/health', '/healthz', '/_health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'The Current-See server is running'
  });
});

// Specific routes to ensure correct file serving
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/my-solar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wallet-ai-features.html'));
});

app.get('/merchandise', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'merchandise.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/solar-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'solar-generator.html'));
});

// Catch-all route for any other paths
app.use((req, res) => {
  // Check if the file exists in public directory
  const filePath = path.join(__dirname, 'public', req.path);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    // Fall back to index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start the server
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`Deployment server running at http://${HOST}:${PORT}/`);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});