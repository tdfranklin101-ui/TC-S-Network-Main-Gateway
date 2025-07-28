/**
 * The Current-See Health Check Script
 * 
 * This script performs a comprehensive health check of all system components
 * including the D-ID AI agent integration and knowledge base functionality.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function makeRequest(url, port = 3000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: url,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function checkHealth() {
  console.log('🔍 The Current-See System Health Check');
  console.log('=====================================\n');

  const checks = [
    { name: 'Server Health', url: '/health' },
    { name: 'Homepage', url: '/' },
    { name: 'QA Meaning Purpose', url: '/qa-meaning-purpose' },
    { name: 'Members API', url: '/api/members' },
    { name: 'Private Network', url: '/private-network' },
    { name: 'Wallet Page', url: '/wallet.html' }
  ];

  const results = [];

  for (const check of checks) {
    try {
      const response = await makeRequest(check.url);
      const success = response.statusCode === 200;
      
      if (success) {
        log(`${check.name}: OK (${response.statusCode})`, 'success');
        results.push({ ...check, status: 'OK', code: response.statusCode });
      } else {
        log(`${check.name}: FAILED (${response.statusCode})`, 'error');
        results.push({ ...check, status: 'FAILED', code: response.statusCode });
      }
    } catch (error) {
      log(`${check.name}: ERROR - ${error.message}`, 'error');
      results.push({ ...check, status: 'ERROR', error: error.message });
    }
  }

  // Check D-ID AI Agent Configuration
  console.log('\n🤖 D-ID AI Agent Status:');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    const hasAgent = content.includes('data-agent-id="v2_agt_vhYf_e_C"');
    const hasScript = content.includes('https://agent.d-id.com/v2/index.js');
    
    if (hasAgent && hasScript) {
      log('D-ID AI Agent: CONFIGURED', 'success');
    } else {
      log('D-ID AI Agent: CONFIGURATION ISSUE', 'error');
    }
  }

  // Check Knowledge Base Files
  console.log('\n📚 Knowledge Base Status:');
  const knowledgeFiles = [
    'qa-meaning-purpose.html',
    'wallet.html',
    'declaration.html',
    'founder_note.html',
    'whitepapers.html',
    'business_plan.html',
    'private-network.html'
  ];

  knowledgeFiles.forEach(file => {
    const filePath = path.join(__dirname, 'public', file);
    const exists = fs.existsSync(filePath);
    if (exists) {
      log(`${file}: AVAILABLE`, 'success');
    } else {
      log(`${file}: MISSING`, 'error');
    }
  });

  // Summary
  const successCount = results.filter(r => r.status === 'OK').length;
  const totalCount = results.length;
  
  console.log('\n📊 Health Check Summary:');
  console.log(`✅ ${successCount}/${totalCount} endpoints healthy`);
  
  if (successCount === totalCount) {
    log('System Status: FULLY FUNCTIONAL', 'success');
  } else {
    log('System Status: ISSUES DETECTED', 'error');
  }

  return results;
}

// Run the health check
checkHealth().catch(console.error);