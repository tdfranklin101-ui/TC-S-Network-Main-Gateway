/**
 * The Current-See Minimal Server
 * 
 * This is a simplified server for deployment that only serves static files
 * and health checks. No complex route parameters that could cause path-to-regexp errors.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const pageIncludes = require('./page-includes');

// Constants
const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Set up middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pageIncludes.createIncludesMiddleware());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a write stream for logging
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Log function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${isError ? 'ERROR:' : 'INFO:'} ${message}`;
  console.log(entry);
  logFile.write(entry + '\n');
}

// HTML Template Processor
function processHtmlTemplate(filePath, res) {
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Replace header placeholder
    if (html.includes('<!-- HEADER_PLACEHOLDER -->')) {
      let headerPath = path.join(__dirname, 'public/includes/header.html');
      if (!fs.existsSync(headerPath)) {
        headerPath = path.join(__dirname, 'public/templates/header.html');
      }
      if (fs.existsSync(headerPath)) {
        const header = fs.readFileSync(headerPath, 'utf8');
        html = html.replace('<!-- HEADER_PLACEHOLDER -->', header);
      }
    }
    
    // Replace footer placeholder
    if (html.includes('<!-- FOOTER_PLACEHOLDER -->')) {
      let footerPath = path.join(__dirname, 'public/includes/footer.html');
      if (!fs.existsSync(footerPath)) {
        footerPath = path.join(__dirname, 'public/templates/footer.html');
      }
      if (fs.existsSync(footerPath)) {
        const footer = fs.readFileSync(footerPath, 'utf8');
        html = html.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
      }
    }
    
    res.send(html);
  } catch (err) {
    log(`Error processing HTML template: ${err.message}`, true);
    res.status(500).send('Server error');
  }
}

// Health check at root path (for Replit deployment)
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ status: 'healthy' });
  }
  processHtmlTemplate(path.join(__dirname, 'public/index.html'), res);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Members API endpoint (simple, no parameters)
app.get('/api/members.json', (req, res) => {
  try {
    const membersFile = path.join(__dirname, 'public/embedded-members');
    if (fs.existsSync(membersFile)) {
      const data = fs.readFileSync(membersFile, 'utf8');
      const membersMatch = data.match(/window\.embeddedMembers\s*=\s*(\[.*?\]);/s);
      if (membersMatch && membersMatch[1]) {
        const members = JSON.parse(membersMatch[1]);
        return res.json(members);
      }
    }
    
    // Fallback data if file doesn't exist or can't be parsed
    res.json([
      { id: 1, name: "Terry D. Franklin", joined_date: "2025-04-09", solar_amount: 19 },
      { id: 2, name: "JF", joined_date: "2025-04-10", solar_amount: 18 },
      { id: 3, name: "Davis", joined_date: "2025-04-18", solar_amount: 10 },
      { id: 4, name: "Miles Franklin", joined_date: "2025-04-18", solar_amount: 10 },
      { id: 5, name: "John D", joined_date: "2025-04-26", solar_amount: 2 }
    ]);
  } catch (err) {
    log(`Error in /api/members.json: ${err.message}`, true);
    res.status(500).json({ error: "Server error" });
  }
});

// Member count API endpoint
app.get('/api/member-count', (req, res) => {
  try {
    const membersFile = path.join(__dirname, 'public/embedded-members');
    if (fs.existsSync(membersFile)) {
      const data = fs.readFileSync(membersFile, 'utf8');
      const membersMatch = data.match(/window\.embeddedMembers\s*=\s*(\[.*?\]);/s);
      if (membersMatch && membersMatch[1]) {
        const members = JSON.parse(membersMatch[1]);
        return res.json({ count: members.length });
      }
    }
    
    // Fallback data
    res.json({ count: 5 });
  } catch (err) {
    log(`Error in /api/member-count: ${err.message}`, true);
    res.status(500).json({ error: "Server error" });
  }
});

// Solar data API endpoint (simple, no parameters)
app.get('/api/solar-data', (req, res) => {
  try {
    const now = new Date();
    const startDate = new Date('2025-04-07T00:00:00Z');
    const diffSeconds = (now - startDate) / 1000;
    const kwhPerSecond = 483333333.5;
    const totalKwh = diffSeconds * kwhPerSecond;
    const totalMkwh = totalKwh / 1000000;
    const totalValue = (totalKwh / 4913) * 136000;
    
    res.json({
      startDate: startDate.toISOString(),
      currentDate: now.toISOString(),
      secondsRunning: diffSeconds,
      daysRunning: Math.floor(diffSeconds / 86400),
      totalKwh: totalKwh,
      totalMkwh: totalMkwh.toFixed(6),
      totalValue: totalValue.toFixed(2),
      formattedValue: new Intl.NumberFormat('en-US', {
        style: 'currency', 
        currency: 'USD'
      }).format(totalValue)
    });
  } catch (err) {
    log(`Error in /api/solar-data: ${err.message}`, true);
    res.status(500).json({ error: "Server error" });
  }
});

// Define HTML page routes
const htmlPages = [
  'about', 'wallet', 'wallet-ai-features', 'prototype', 'whitepapers',
  'business_plan', 'declaration', 'founder_note', 'mission', 'our-technology',
  'roadmap', 'governance', 'solar-generator', 'research', 'solar-calculator',
  'faq', 'glossary', 'merch', 'app', 'energy-scanner', 'api', 'members',
  'stories', 'partners', 'events', 'blog', 'news', 'contact', 'terms',
  'privacy', 'cookies'
];

// Register routes for each HTML page
htmlPages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    const filePath = path.join(__dirname, `public/${page}.html`);
    if (fs.existsSync(filePath)) {
      processHtmlTemplate(filePath, res);
    } else {
      // If the specific page doesn't exist, create a temporary placeholder
      const placeholderPath = path.join(__dirname, 'public/placeholder.html');
      if (fs.existsSync(placeholderPath)) {
        processHtmlTemplate(placeholderPath, res);
      } else {
        res.status(404).send('Page not found');
      }
    }
  });
});

// Catchall route - serve index.html without route parameters
app.use((req, res) => {
  if (req.url.endsWith('.html')) {
    const filePath = path.join(__dirname, 'public', req.url);
    if (fs.existsSync(filePath)) {
      processHtmlTemplate(filePath, res);
    } else {
      res.status(404).send('Page not found');
    }
  } else {
    processHtmlTemplate(path.join(__dirname, 'public/index.html'), res);
  }
});

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  log(`=== The Current-See Minimal Server ===`);
  log(`Server running on http://0.0.0.0:${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export server for testing
module.exports = server;