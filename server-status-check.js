/**
 * Server Status Check after deployment restart
 */

const http = require('http');
const fs = require('fs');

console.log('Server Status Check after Deployment Restart');
console.log('===========================================\n');

// Check if server files exist
const files = ['main.js', 'public/index.html'];
files.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
});

// Test server health
const testHealth = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ success: true, data }));
    });
    req.on('error', (error) => resolve({ success: false, error: error.message }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
};

// Test homepage
const testHomepage = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ success: true, data: data.substring(0, 200) }));
    });
    req.on('error', (error) => resolve({ success: false, error: error.message }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
  });
};

// Run tests
(async () => {
  console.log('\nTesting server endpoints...');
  
  const healthResult = await testHealth();
  if (healthResult.success) {
    console.log('✅ Health endpoint: WORKING');
    try {
      const health = JSON.parse(healthResult.data);
      console.log('   Status:', health.status);
      console.log('   Port:', health.port);
    } catch (e) {
      console.log('   Raw response:', healthResult.data.substring(0, 100));
    }
  } else {
    console.log('❌ Health endpoint: FAILED');
    console.log('   Error:', healthResult.error);
  }
  
  const homepageResult = await testHomepage();
  if (homepageResult.success) {
    console.log('✅ Homepage: WORKING');
    const hasCurrentSee = homepageResult.data.includes('Current-See');
    console.log('   Contains Current-See:', hasCurrentSee ? 'YES' : 'NO');
  } else {
    console.log('❌ Homepage: FAILED');
    console.log('   Error:', homepageResult.error);
  }
  
  console.log('\nServer configuration status:');
  const serverContent = fs.readFileSync('main.js', 'utf8');
  console.log('✅ Health endpoint configured:', serverContent.includes('/health'));
  console.log('✅ Port 3000 configured:', serverContent.includes('3000'));
  console.log('✅ Static files configured:', serverContent.includes('express.static'));
})();