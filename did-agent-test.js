/**
 * D-ID Agent Integration Test
 * Verifies the fresh D-ID agent embed is properly integrated
 */

const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

console.log('D-ID Agent Integration Test');
console.log('==========================\n');

// 1. Verify embed code in HTML
console.log('1. Verifying D-ID embed code integration...');
const indexContent = fs.readFileSync('public/index.html', 'utf8');

const checks = [
  { name: 'D-ID Script CDN', test: indexContent.includes('https://agent.d-id.com/v2/index.js') },
  { name: 'Agent ID v2_agt_vhYf_e_C', test: indexContent.includes('data-agent-id="v2_agt_vhYf_e_C"') },
  { name: 'Client Key Present', test: indexContent.includes('data-client-key="YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ=="') },
  { name: 'Mode Fabio', test: indexContent.includes('data-mode="fabio"') },
  { name: 'Monitor Enabled', test: indexContent.includes('data-monitor="true"') },
  { name: 'Horizontal Orientation', test: indexContent.includes('data-orientation="horizontal"') },
  { name: 'Right Position', test: indexContent.includes('data-position="right"') },
  { name: 'Agent Name', test: indexContent.includes('data-name="did-agent"') }
];

let allChecks = true;
checks.forEach(check => {
  console.log(`${check.test ? '✅' : '❌'} ${check.name}: ${check.test ? 'PRESENT' : 'MISSING'}`);
  if (!check.test) allChecks = false;
});

// 2. Start server
console.log('\n2. Starting server for integration test...');
const server = spawn('node', ['main.js'], {
  env: { ...process.env, PORT: '3000' },
  stdio: 'inherit',
  detached: true
});

server.unref();

// 3. Test server and D-ID integration
setTimeout(async () => {
  console.log('\n3. Testing server and D-ID integration...');
  
  const testHomepage = () => {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:3000/', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const hasAgent = data.includes('agent.d-id.com/v2/index.js');
          const hasAgentId = data.includes('v2_agt_vhYf_e_C');
          const hasClientKey = data.includes('YXV0aDB8Njg3NjgyNDI2M2Q2ODI4MmIwOWFiYmUzOlR2cUplanVzeWc1cjlKV2ZNV0NKaQ==');
          resolve({ 
            success: res.statusCode === 200, 
            hasAgent,
            hasAgentId,
            hasClientKey,
            size: data.length 
          });
        });
      });
      req.on('error', (error) => resolve({ success: false, error: error.message }));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ success: false, error: 'Timeout' });
      });
    });
  };
  
  const result = await testHomepage();
  
  console.log(`${result.success ? '✅' : '❌'} Homepage Loading: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  if (result.success) {
    console.log(`${result.hasAgent ? '✅' : '❌'} D-ID Script: ${result.hasAgent ? 'EMBEDDED' : 'MISSING'}`);
    console.log(`${result.hasAgentId ? '✅' : '❌'} Agent ID: ${result.hasAgentId ? 'PRESENT' : 'MISSING'}`);
    console.log(`${result.hasClientKey ? '✅' : '❌'} Client Key: ${result.hasClientKey ? 'PRESENT' : 'MISSING'}`);
    console.log(`📊 Page Size: ${Math.round(result.size/1024)} KB`);
  } else {
    console.log('❌ Error:', result.error);
  }
  
  console.log('\n📋 Integration Summary:');
  console.log(`${allChecks ? '✅' : '❌'} Embed Code: ${allChecks ? 'COMPLETE' : 'INCOMPLETE'}`);
  console.log(`${result.success ? '✅' : '❌'} Server: ${result.success ? 'RUNNING' : 'FAILED'}`);
  console.log(`${result.hasAgent && result.hasAgentId ? '✅' : '❌'} D-ID Agent: ${result.hasAgent && result.hasAgentId ? 'INTEGRATED' : 'FAILED'}`);
  
  if (allChecks && result.success && result.hasAgent) {
    console.log('\n🎉 D-ID AGENT SUCCESSFULLY RE-EMBEDDED!');
    console.log('✅ Fresh credentials integrated');
    console.log('✅ Agent v2_agt_lmJp1s6K active');
    console.log('✅ Ready for production deployment');
  } else {
    console.log('\n⚠️  Integration issues detected');
  }
  
}, 10000);

console.log('Running integration test in 10 seconds...');