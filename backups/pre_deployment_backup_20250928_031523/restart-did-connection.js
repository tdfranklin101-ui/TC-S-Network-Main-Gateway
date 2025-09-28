/**
 * Restart D-ID AI Agent Connection
 * This script restarts the server and forces a fresh D-ID connection
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🔄 Restarting D-ID AI Agent Connection...');
console.log('=====================================\n');

// Kill existing node processes
console.log('1. Stopping existing server...');
const killCommand = spawn('pkill', ['-f', 'node'], { stdio: 'inherit' });

killCommand.on('close', (code) => {
  console.log('2. Server stopped, waiting 3 seconds...');
  
  setTimeout(() => {
    console.log('3. Starting fresh server with D-ID connection...');
    
    // Start server with environment variables
    const serverProcess = spawn('node', ['main.js'], {
      env: { ...process.env, PORT: '3000' },
      stdio: 'inherit',
      detached: true
    });
    
    serverProcess.unref();
    
    console.log('4. Server started with fresh D-ID connection');
    console.log('5. D-ID agent should reconnect automatically');
    console.log('\n✅ Restart complete - D-ID agent should be available now');
    
    // Check server health after a few seconds
    setTimeout(() => {
      console.log('\n🔍 Checking server health...');
      const healthCheck = spawn('curl', ['-s', 'http://localhost:3000/health'], { stdio: 'pipe' });
      
      healthCheck.stdout.on('data', (data) => {
        console.log('Server response:', data.toString());
      });
      
      healthCheck.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Server is running successfully');
          console.log('🌐 Visit http://localhost:3000 to check D-ID agent');
        } else {
          console.log('⚠️ Server health check failed');
        }
      });
    }, 8000);
    
  }, 3000);
});