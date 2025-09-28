/**
 * Hard Boot Deployment System
 * Creates fresh deployment with complete cache bypass
 */

const fs = require('fs');
const express = require('express');
const path = require('path');

console.log('🔄 HARD BOOT DEPLOYMENT: Starting fresh server...');

const app = express();
const PORT = process.env.PORT || 3000;

// Force no-cache headers for everything
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Cache-Bypass': 'hard-boot-20250728'
  });
  next();
});

// Serve static files with cache-busting
app.use(express.static('.', {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
}));

// Health check with hard boot confirmation
app.get('/health', (req, res) => {
  res.json({
    status: 'HARD_BOOT_ACTIVE',
    timestamp: new Date().toISOString(),
    didAgent: 'v2_agt_vhYf_e_C',
    cacheStatus: 'BYPASSED',
    deployment: 'FRESH_INSTALLATION'
  });
});

// Force fresh HTML with cache-busting
app.get('/', (req, res) => {
  const hardBootTimestamp = Date.now();
  
  // Read and modify index.html with fresh cache-busting
  let html = fs.readFileSync('index.html', 'utf8');
  
  // Replace D-ID script with hard cache-busting
  html = html.replace(
    /src="https:\/\/agent\.d-id\.com\/v2\/index\.js\?[^"]*"/,
    `src="https://agent.d-id.com/v2/index.js?hardboot=${hardBootTimestamp}"`
  );
  
  // Update agent name with unique identifier
  html = html.replace(
    /data-name="[^"]*"/,
    `data-name="console-solar-hardboot-${hardBootTimestamp}"`
  );
  
  // Add hard boot script injection
  const hardBootScript = `
    <script>
      console.log('🔄 HARD BOOT: Cache completely bypassed');
      console.log('⚡ Fresh D-ID agent loading: v2_agt_vhYf_e_C');
      console.log('🎯 Expected: Console Solar - Kid Solar');
      
      // Clear all possible D-ID caches
      localStorage.clear();
      sessionStorage.clear();
      
      // Force refresh D-ID components
      setTimeout(() => {
        console.log('✅ Hard boot cache clearing complete');
      }, 1000);
    </script>
  `;
  
  html = html.replace('</head>', hardBootScript + '</head>');
  
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HARD BOOT SERVER: Running on port ${PORT}`);
  console.log('🚀 Complete cache bypass active');
  console.log('⚡ Fresh D-ID agent should load without interference');
});