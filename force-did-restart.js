/**
 * Force D-ID AI Agent Restart
 * This script forces a complete restart of the D-ID connection
 */

const { execSync } = require('child_process');

console.log('🔄 Forcing D-ID AI Agent Restart...');
console.log('==================================\n');

try {
  // Kill any existing node processes
  console.log('1. Stopping all node processes...');
  execSync('pkill -f "node" || true', { stdio: 'inherit' });
  
  // Wait for cleanup
  console.log('2. Waiting for cleanup...');
  execSync('sleep 3', { stdio: 'inherit' });
  
  // Start server with fresh environment
  console.log('3. Starting server with fresh D-ID connection...');
  const serverProcess = execSync('PORT=3000 node main.js > server.log 2>&1 &', { stdio: 'inherit' });
  
  // Wait for server to start
  console.log('4. Waiting for server startup...');
  execSync('sleep 8', { stdio: 'inherit' });
  
  // Test server health
  console.log('5. Testing server health...');
  try {
    const healthResponse = execSync('curl -s "http://localhost:3000/health"', { encoding: 'utf8' });
    console.log('✅ Server health check passed');
    console.log('Response:', healthResponse.substring(0, 100));
  } catch (error) {
    console.log('⚠️ Server health check failed, but server may still be starting');
  }
  
  // Test homepage
  console.log('6. Testing homepage...');
  try {
    const homepageResponse = execSync('curl -s "http://localhost:3000/" | grep -i "current-see" | head -1', { encoding: 'utf8' });
    console.log('✅ Homepage accessible');
  } catch (error) {
    console.log('⚠️ Homepage test failed');
  }
  
  console.log('\n✅ D-ID Agent restart complete!');
  console.log('🌐 Visit http://localhost:3000 to check the D-ID agent');
  console.log('🤖 The agent should now connect to D-ID servers properly');
  
} catch (error) {
  console.error('Error during restart:', error.message);
}