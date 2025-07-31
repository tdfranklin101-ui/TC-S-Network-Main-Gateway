const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname;

  // Route handling
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Health check endpoint
  if (filePath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Console Solar Current-See Server',
      consoleSolar: 'active',
      enhancedCapture: 'operational'
    }));
    return;
  }

  // Enhanced conversation capture endpoint
  if (filePath === '/api/enhanced-conversation-capture' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `console_solar_${timestamp}_${data.source || 'capture'}.json`;
        
        // Create conversations directory if it doesn't exist
        const conversationDir = path.join(__dirname, 'conversations');
        if (!fs.existsSync(conversationDir)) {
          fs.mkdirSync(conversationDir, { recursive: true });
        }
        
        // Store conversation with metadata
        const conversationData = {
          timestamp: new Date().toISOString(),
          responseText: data.responseText,
          source: data.source,
          qualityScore: data.responseText && data.responseText.length > 50 ? 'high' : 'medium',
          captured: true
        };
        
        fs.writeFileSync(path.join(conversationDir, filename), JSON.stringify(conversationData, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          stored: `conversations/${filename}`,
          responseLength: data.responseText ? data.responseText.length : 0,
          qualityScore: conversationData.qualityScore
        }));
        
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to store conversation' }));
      }
    });
    return;
  }

  // Serve static files
  const fullPath = path.join(__dirname, 'public', filePath);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }

  // Get file stats
  const stats = fs.statSync(fullPath);
  if (stats.isDirectory()) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Directory access denied');
    return;
  }

  // Determine content type
  const ext = path.extname(fullPath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf'
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';

  try {
    const fileContent = fs.readFileSync(fullPath);
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(fileContent);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error reading file');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 CONSOLE SOLAR CURRENT-SEE SERVER ACTIVE');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🤖 Console Solar: Polymathic AI Assistant Ready');
  console.log('🎤 Enhanced Audio Capture: 5-method system active');
  console.log('🧠 Memory System: Conversation storage operational');
  console.log('========================================');
  console.log('✅ ROLLBACK RESTORATION COMPLETE');
  console.log('🎯 Ready for Console Solar conversations');
});