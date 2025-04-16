/**
 * Simple Production Server for The Current-See
 * 
 * A minimal server implementation for deploying the website
 * that handles both serving static files and health checks.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(PUBLIC_DIR, 'includes');

// Logging function
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Health check endpoint - explicit route for monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Root endpoint - special handling for deployment health checks
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
      
      // Ensure scripts are properly loaded after DOM content
      if (indexContent.includes('/js/real_time_solar_counter.js')) {
        log('Found solar counter script in index.html, ensuring proper initialization');
        
        // Make sure trySolarCounterInit is called after page fully loads
        const additionalScript = `
<script>
  // Ensure solar counter initialization happens after DOM is fully loaded
  window.addEventListener('load', function() {
    console.log('Window fully loaded with injected content, running solar counter init');
    setTimeout(function() {
      if (typeof trySolarCounterInit === 'function') {
        trySolarCounterInit();
      }
    }, 100);
  });
</script>`;
        
        // Add script just before closing body tag
        indexContent = indexContent.replace('</body>', additionalScript + '</body>');
      }
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(indexContent);
  } catch (error) {
    log(`Error serving index.html: ${error.message}`);
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
      
      // Ensure scripts are properly loaded after DOM content
      if (content.includes('/js/real_time_solar_counter.js')) {
        log(`Found solar counter script in ${req.path}, ensuring proper initialization`);
        
        // Make sure trySolarCounterInit is called after page fully loads
        // by adding an additional script before closing body tag
        const additionalScript = `
<script>
  // Ensure solar counter initialization happens after DOM is fully loaded
  window.addEventListener('load', function() {
    console.log('Window fully loaded with injected content, running solar counter init');
    setTimeout(function() {
      if (typeof trySolarCounterInit === 'function') {
        trySolarCounterInit();
      }
    }, 100);
  });
</script>`;
        
        // Add script just before closing body tag
        content = content.replace('</body>', additionalScript + '</body>');
      }
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    log(`Error serving ${req.path}: ${error.message}`);
    next();
  }
});

// Serve static files
app.use(express.static(PUBLIC_DIR));

// Fallback handler for SPA-like navigation (without using path-to-regexp)
app.use((req, res) => {
  // If the file doesn't exist, route to index.html
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #4caf50; }
          a { color: #4caf50; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p><a href="/">Return to Home</a></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  log(`The Current-See server running on port ${PORT}`);
  log(`Serving static files from: ${PUBLIC_DIR}`);
});

// Handle termination signals
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  process.exit(0);
});