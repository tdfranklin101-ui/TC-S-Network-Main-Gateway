/**
 * Server Restart Script
 * Restarts the server and confirms it's running correctly
 */

const { spawn, execSync } = require('child_process');
const http = require('http');

console.log('The Current-See Server Restart');
console.log('==============================\n');

// Kill any existing processes
try {
  execSync('pkill -f "node main.js" || true', { stdio: 'inherit' });
  console.log('✅ Stopped existing server processes');
} catch (error) {
  console.log('ℹ️  No existing processes to stop');
}

// Wait for cleanup
console.log('⏳ Waiting for cleanup...');
execSync('sleep 3');

// Start server
console.log('🚀 Starting server...');
const server = spawn('node', ['main.js'], {
  env: { ...process.env, PORT: '3000' },
  stdio: 'inherit',
  detached: true
});

server.unref();

// Test server after startup
setTimeout(async () => {
  console.log('\n🔍 Testing server health...');
  
  const testHealth = () => {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3000/health', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            resolve({ success: true, health });
          } catch (e) {
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        });
      });
      req.on('error', (error) => resolve({ success: false, error: error.message }));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ success: false, error: 'Timeout' });
      });
    });
  };
  
  const result = await testHealth();
  
  if (result.success) {
    console.log('✅ Server is running correctly!');
    console.log('   Status:', result.health.status);
    console.log('   Port:', result.health.port);
    console.log('   URL: http://localhost:3000');
    console.log('\n🎯 Server restart completed successfully');
  } else {
    console.log('❌ Server health check failed:', result.error);
    console.log('   Server may still be starting up');
  }
}, 10000);

console.log('Server started. Health check will run in 10 seconds...');