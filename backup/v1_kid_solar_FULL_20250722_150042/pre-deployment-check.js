/**
 * Pre-Deployment Final Check
 * Comprehensive verification before going live
 */

const fs = require('fs');
const http = require('http');

console.log('🚀 The Current-See Pre-Deployment Check');
console.log('======================================\n');

// Critical files check
const criticalFiles = [
  { file: 'main.js', desc: 'Server file' },
  { file: 'public/index.html', desc: 'Homepage' },
  { file: 'public/qa-meaning-purpose.html', desc: 'Q&A page' },
  { file: 'public/wallet.html', desc: 'Wallet interface' },
  { file: 'public/private-network.html', desc: 'Private network' },
  { file: 'public/declaration.html', desc: 'Declaration' },
  { file: 'public/founder_note.html', desc: 'Founder note' },
  { file: 'public/whitepapers.html', desc: 'Whitepapers' },
  { file: 'public/business_plan.html', desc: 'Business plan' }
];

console.log('📁 Critical Files:');
let totalSize = 0;
let allPresent = true;

criticalFiles.forEach(item => {
  const exists = fs.existsSync(item.file);
  const size = exists ? fs.statSync(item.file).size : 0;
  totalSize += size;
  console.log(`${exists ? '✅' : '❌'} ${item.desc}: ${exists ? `${Math.round(size/1024)} KB` : 'MISSING'}`);
  if (!exists) allPresent = false;
});

console.log(`📊 Total size: ${Math.round(totalSize/1024)} KB`);

// Server configuration check
console.log('\n🔧 Server Configuration:');
const serverContent = fs.readFileSync('main.js', 'utf8');
const serverChecks = [
  { check: 'Health endpoint', pass: serverContent.includes("app.get('/health'") },
  { check: 'Static files', pass: serverContent.includes('express.static') },
  { check: 'QA route', pass: serverContent.includes('/qa-meaning-purpose') },
  { check: 'Wallet route', pass: serverContent.includes('/wallet.html') },
  { check: 'Private network', pass: serverContent.includes('/private-network') },
  { check: 'Members API', pass: serverContent.includes('/api/members') },
  { check: 'Port 3000', pass: serverContent.includes('3000') }
];

let serverOk = true;
serverChecks.forEach(item => {
  console.log(`${item.pass ? '✅' : '❌'} ${item.check}: ${item.pass ? 'CONFIGURED' : 'MISSING'}`);
  if (!item.pass) serverOk = false;
});

// D-ID configuration check
console.log('\n🤖 D-ID AI Agent:');
const indexContent = fs.readFileSync('public/index.html', 'utf8');
const didChecks = [
  { check: 'Script CDN', pass: indexContent.includes('https://agent.d-id.com/v2/index.js') },
  { check: 'Agent ID', pass: indexContent.includes('data-agent-id="v2_agt_lmJp1s6K"') },
  { check: 'Client key', pass: indexContent.includes('data-client-key=') },
  { check: 'Mode fabio', pass: indexContent.includes('data-mode="fabio"') },
  { check: 'Horizontal', pass: indexContent.includes('data-orientation="horizontal"') },
  { check: 'Right position', pass: indexContent.includes('data-position="right"') }
];

let didOk = true;
didChecks.forEach(item => {
  console.log(`${item.pass ? '✅' : '❌'} ${item.check}: ${item.pass ? 'CONFIGURED' : 'MISSING'}`);
  if (!item.pass) didOk = false;
});

// Server health test
const testServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({ success: true, health });
        } catch (e) {
          resolve({ success: false, error: 'Invalid response' });
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

// Run server test
setTimeout(async () => {
  console.log('\n🌐 Server Health Test:');
  const result = await testServer();
  
  if (result.success) {
    console.log('✅ Server health: PASSING');
    console.log('   Status:', result.health.status);
    console.log('   Port:', result.health.port);
  } else {
    console.log('❌ Server health: FAILED');
    console.log('   Error:', result.error);
  }
  
  console.log('\n📋 Deployment Readiness:');
  console.log(`${allPresent ? '✅' : '❌'} All files present: ${allPresent ? 'YES' : 'NO'}`);
  console.log(`${serverOk ? '✅' : '❌'} Server config: ${serverOk ? 'COMPLETE' : 'INCOMPLETE'}`);
  console.log(`${didOk ? '✅' : '❌'} D-ID agent: ${didOk ? 'CONFIGURED' : 'INCOMPLETE'}`);
  console.log(`${result.success ? '✅' : '❌'} Server health: ${result.success ? 'PASSING' : 'FAILING'}`);
  
  if (allPresent && serverOk && didOk && result.success) {
    console.log('\n🎉 READY FOR DEPLOYMENT!');
    console.log('All systems verified and functional');
    console.log('D-ID AI agent will connect once deployed');
  } else {
    console.log('\n⚠️  Deployment issues detected');
  }
}, 10000);

console.log('\nRunning server health test in 10 seconds...');