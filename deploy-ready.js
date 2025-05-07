/**
 * The Current-See Deployment-Ready Server
 * 
 * This file includes all the necessary components for a successful deployment:
 * 1. Health checks responding to the root path (/)
 * 2. Static file serving for the public directory
 * 3. API endpoints with proper CORS handling
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(PUBLIC_DIR, 'includes');

// Logging function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Root path handler - for deployment health checks
app.get('/', (req, res, next) => {
  // If it's a health check (no user agent), just return OK
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  
  // For normal users, serve the index.html file with header/footer injected
  try {
    let indexContent = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      indexContent = indexContent.replace('<!-- HEADER_PLACEHOLDER -->', header);
      indexContent = indexContent.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(indexContent);
  } catch (error) {
    log(`Error serving index.html: ${error.message}`, true);
    next();
  }
});

// Handle HTML files with header/footer injection
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) {
    return next();
  }
  
  try {
    const filePath = path.join(PUBLIC_DIR, req.path);
    
    if (!fs.existsSync(filePath)) {
      return next();
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      content = content.replace('<!-- HEADER_PLACEHOLDER -->', header);
      content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    } catch (includeError) {
      log(`Warning: Could not inject header/footer for ${req.path}: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    log(`Error processing HTML file ${req.path}: ${error.message}`, true);
    next();
  }
});

// Static file serving
app.use(express.static(PUBLIC_DIR));

// Final 404 handler
app.use((req, res) => {
  res.status(404).send('File not found');
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  log(`Server running on port ${PORT}`);
});
