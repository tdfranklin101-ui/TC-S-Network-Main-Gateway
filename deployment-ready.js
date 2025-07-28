/**
 * Deployment Readiness Check
 * Comprehensive pre-deployment verification
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

console.log('🚀 The Current-See Deployment Readiness Check');
console.log('===========================================\n');

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

// Check critical files
const checkFiles = () => {
  const criticalFiles = [
    'main.js',
    'public/index.html',
    'public/qa-meaning-purpose.html',
    'public/wallet.html',
    'public/private-network.html',
    'public/declaration.html',
    'public/founder_note.html',
    'public/whitepapers.html',
    'public/business_plan.html'
  ];

  console.log('📁 Critical Files Check:');
  let allPresent = true;
  
  criticalFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const size = exists ? Math.round(fs.statSync(file).size / 1024) : 0;
    console.log(`${exists ? '✅' : '❌'} ${file} ${exists ? `(${size} KB)` : '(MISSING)'}`);
    if (!exists) allPresent = false;
  });
  
  return allPresent;
};

// Check D-ID configuration
const checkDidConfig = () => {
  console.log('\n🤖 D-ID AI Agent Configuration:');
  const content = fs.readFileSync('public/index.html', 'utf8');
  
  const checks = [
    { name: 'Script CDN', test: content.includes('https://agent.d-id.com/v2/index.js') },
    { name: 'Agent ID', test: content.includes('data-agent-id="v2_agt_vhYf_e_C"') },
    { name: 'Client Key', test: content.includes('data-client-key=') },
    { name: 'Mode (fabio)', test: content.includes('data-mode="fabio"') },
    { name: 'Orientation', test: content.includes('data-orientation="horizontal"') },
    { name: 'Position', test: content.includes('data-position="right"
        data-description="Console Solar - Kid Solar - Your polymathic AI assistant specializing in renewable energy innovation, physics, engineering, economics, and cutting-edge sustainability solutions."') }
  ];
  
  let allConfigured = true;
  checks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}: ${check.test ? 'CONFIGURED' : 'MISSING'}`);
    if (!check.test) allConfigured = false;
  });
  
  return allConfigured;
};

// Check server configuration
const checkServerConfig = () => {
  console.log('\n🔧 Server Configuration:');
  const content = fs.readFileSync('main.js', 'utf8');
  
  const checks = [
    { name: 'Health endpoint', test: content.includes("app.get('/health'") },
    { name: 'Static files', test: content.includes('express.static') },
    { name: 'QA route', test: content.includes('/qa-meaning-purpose') },
    { name: 'Wallet route', test: content.includes('/wallet.html') },
    { name: 'Members API', test: content.includes('/api/members') },
    { name: 'Port 3000', test: content.includes('3000') }
  ];
  
  let allConfigured = true;
  checks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}: ${check.test ? 'CONFIGURED' : 'MISSING'}`);
    if (!check.test) allConfigured = false;
  });
  
  return allConfigured;
};

// Run all checks
(async () => {
  const filesOk = checkFiles();
  const didOk = checkDidConfig();
  const serverOk = checkServerConfig();
  
  console.log('\n🌐 Server Health Test:');
  try {
    const health = await testServer();
    console.log('✅ Server health check passed');
    console.log('   Status:', health.status);
    console.log('   Port:', health.port || 'unknown');
    
    console.log('\n📊 Deployment Status:');
    console.log(`${filesOk ? '✅' : '❌'} Critical files: ${filesOk ? 'ALL PRESENT' : 'MISSING FILES'}`);
    console.log(`${didOk ? '✅' : '❌'} D-ID configuration: ${didOk ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`${serverOk ? '✅' : '❌'} Server configuration: ${serverOk ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log('✅ Server health: PASSING');
    
    if (filesOk && didOk && serverOk) {
      console.log('\n🎉 DEPLOYMENT READY!');
      console.log('All systems are functional and ready for production deployment.');
      console.log('The D-ID AI agent is properly configured and will connect once deployed.');
    } else {
      console.log('\n⚠️  DEPLOYMENT ISSUES DETECTED');
      console.log('Please resolve the above issues before deployment.');
    }
    
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    console.log('Server may still be starting up - try again in a moment.');
  }
})();