/**
 * The Current-See Minimal Deployment Server (CommonJS Version)
 * This file handles both the health checks and serves a simple splash page
 */

// CommonJS imports
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Constants
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage fallback for members count
const membersCount = 1;

// High priority health check routes that respond to all paths
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Log all requests to help with debugging
  console.log(`[REQUEST] ${req.method} ${req.url} (${userAgent})`);
  
  // Detect if request is from Replit deployment system
  const isReplitHealthCheck = 
    userAgent.includes('Replit') || 
    userAgent.includes('GoogleHC') || 
    req.url === '/health' || 
    req.url === '/healthz' || 
    req.url === '/_health';
  
  if (isReplitHealthCheck) {
    console.log(`[HEALTH] Health check detected: ${req.url}`);
    res.status(200).send('OK');
    return;
  }
  
  next();
});

// Simple splash page for all other routes
app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>The Current-See - Coming Soon</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #ffe082, #ffca28, #ffa000);
          color: #333;
          line-height: 1.6;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .container {
          width: 90%;
          max-width: 600px;
          padding: 40px;
          background-color: rgba(255, 255, 255, 0.9);
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        h1 {
          color: #2a9d8f;
          font-size: 2.5rem;
          margin-bottom: 20px;
        }
        p {
          font-size: 1.2rem;
          margin-bottom: 30px;
        }
        .cta {
          display: inline-block;
          background-color: #2a9d8f;
          color: white;
          padding: 12px 30px;
          font-size: 1.1rem;
          border-radius: 5px;
          text-decoration: none;
          transition: background-color 0.3s;
        }
        .cta:hover {
          background-color: #218579;
        }
        .counter {
          margin-top: 30px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 8px;
          display: inline-block;
        }
        footer {
          margin-top: 40px;
          font-size: 0.9rem;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>The Current-See</h1>
        <p>We're revolutionizing the economy with solar energy. Our full website is coming soon!</p>
        <p>Join our waitlist to be among the first to receive your SOLAR distribution.</p>
        <a href="mailto:info@thecurrentsee.org" class="cta">Contact Us</a>
        <div class="counter">
          <p>Members waiting: ${membersCount}</p>
        </div>
        <footer>
          <p>&copy; 2025 The Current-See PBC, Inc. All rights reserved.</p>
        </footer>
      </div>
    </body>
    </html>
  `);
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