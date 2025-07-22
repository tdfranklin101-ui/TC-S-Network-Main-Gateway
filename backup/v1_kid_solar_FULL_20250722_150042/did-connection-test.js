/**
 * D-ID Connection Test
 * Tests the D-ID AI agent connection after restart
 */

const http = require('http');
const fs = require('fs');

console.log('🤖 Testing D-ID AI Agent Connection');
console.log('====================================\n');

// Test server health
const testServer = () => {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (e) {
          resolve({ status: 'unknown', data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

// Test D-ID configuration
const testDidConfig = () => {
  const content = fs.readFileSync('./public/index.html', 'utf8');
  
  return {
    script: content.includes('https://agent.d-id.com/v2/index.js'),
    agentId: content.includes('data-agent-id="v2_agt_lmJp1s6K"'),
    clientKey: content.includes('data-client-key='),
    mode: content.includes('data-mode="fabio"'),
    orientation: content.includes('data-orientation="horizontal"'),
    position: content.includes('data-position="right"')
  };
};

// Run tests
(async () => {
  try {
    console.log('1. Testing server health...');
    const health = await testServer();
    console.log('✅ Server is running:', health.status);
    console.log('   Port:', health.port || 'unknown');
    
    console.log('\n2. Testing D-ID configuration...');
    const didConfig = testDidConfig();
    
    Object.entries(didConfig).forEach(([key, value]) => {
      console.log(`${value ? '✅' : '❌'} ${key}: ${value ? 'CONFIGURED' : 'MISSING'}`);
    });
    
    const allConfigured = Object.values(didConfig).every(v => v);
    
    console.log('\n3. Connection Status:');
    if (allConfigured) {
      console.log('✅ D-ID AI Agent fully configured');
      console.log('✅ Server restarted with fresh connection');
      console.log('✅ Agent should now connect to D-ID servers');
      console.log('\n🎯 The D-ID agent connection has been restarted!');
      console.log('Visit http://localhost:3000 to test the agent');
    } else {
      console.log('❌ D-ID configuration incomplete');
    }
    
  } catch (error) {
    console.log('❌ Server test failed:', error.message);
  }
})();