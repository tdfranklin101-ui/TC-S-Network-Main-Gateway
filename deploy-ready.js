/**
 * The Current-See Deployment-Ready Server
 * 
 * This file includes all the necessary components for a successful deployment:
 * 1. Health checks responding to the root path (/)
 * 2. Static file serving for the public directory
 * 3. API endpoints with proper CORS handling
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'The Current-See',
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API routes (mock for deployment testing)
app.get('/api/user', (req, res) => {
  res.status(401).json({ error: 'Authentication required' });
});

app.get('/api/solar-generator', (req, res) => {
  // Generate solar data based on time since April 7, 2025
  const startDate = new Date('2025-04-07T00:00:00Z');
  const currentDate = new Date();
  const timeDiffMs = currentDate.getTime() - startDate.getTime();
  const secondsElapsed = Math.floor(timeDiffMs / 1000);
  
  // Solar generation rate calculation
  const kwhPerSolar = 4913; // 4,913 kWh per SOLAR
  const dollarPerSolar = 136000; // $136,000 per SOLAR
  const solarPerSecond = 1 / (24 * 60 * 60); // 1 SOLAR per day
  
  const totalSolar = solarPerSecond * secondsElapsed;
  const totalKwh = totalSolar * kwhPerSolar;
  const totalDollars = totalSolar * dollarPerSolar;
  
  res.json({
    startDate: startDate.toISOString(),
    currentDate: currentDate.toISOString(),
    secondsElapsed,
    totalSolar,
    totalKwh,
    totalDollars
  });
});

// Fallback handler for SPA routing
app.get('*', (req, res) => {
  // Check if the request is for an HTML file or a URL path
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // If the file exists, serve it directly
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    // Otherwise, serve index.html for client-side routing
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // For non-HTML requests (like API calls), return 404
    res.status(404).json({ error: 'Not found' });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});