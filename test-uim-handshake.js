#!/usr/bin/env node

/**
 * UIM Handshake Protocol Test Suite
 * Tests the TC-S Network Foundation UIM node endpoints
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 UIM Handshake Protocol Test Suite\n');
  console.log(`Testing endpoints at: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Hello Response
  try {
    console.log('Test 1: GET /protocols/uim-handshake/v1.0/hello');
    const response = await makeRequest('/protocols/uim-handshake/v1.0/hello');
    
    if (response.statusCode === 200) {
      console.log('  ✅ Status: 200 OK');
      console.log(`  ✅ Node ID: ${response.body.node_id}`);
      console.log(`  ✅ Protocol Version: ${response.body.protocol_version}`);
      console.log(`  ✅ Capabilities: ${response.body.capabilities.length} listed`);
      console.log(`  ✅ Solar Endpoint: ${response.body.solar_endpoint}`);
      passed++;
    } else {
      console.log(`  ❌ Failed: Status ${response.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 2: Semantic Profile
  try {
    console.log('Test 2: GET /protocols/uim-handshake/v1.0/profile');
    const response = await makeRequest('/protocols/uim-handshake/v1.0/profile');
    
    if (response.statusCode === 200) {
      console.log('  ✅ Status: 200 OK');
      console.log(`  ✅ Semantic Domains: ${response.body.semantic_domains.length} listed`);
      console.log(`  ✅ Ethical Framework: ${response.body.ethical_framework.name}`);
      console.log(`  ✅ Adherence Level: ${response.body.ethical_framework.adherence_level}`);
      console.log(`  ✅ Rights Alignment: ${Object.keys(response.body.ethical_framework.rights_alignment).length} checks`);
      passed++;
    } else {
      console.log(`  ❌ Failed: Status ${response.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    failed++;
  }

  console.log('');

  // Test 3: Task Proposal
  try {
    console.log('Test 3: POST /protocols/uim-handshake/v1.0/task');
    const taskProposal = {
      task_id: 'test-task-001',
      proposing_node: 'test-ai-node-001',
      task_type: 'data-analysis',
      input_context: 'Request renewable energy data for 2025',
      max_solar_budget: 0.005
    };
    
    const response = await makeRequest('/protocols/uim-handshake/v1.0/task', 'POST', taskProposal);
    
    if (response.statusCode === 200) {
      console.log('  ✅ Status: 200 OK');
      console.log(`  ✅ Task Status: ${response.body.status}`);
      console.log(`  ✅ Accepting Node: ${response.body.accepting_node}`);
      console.log(`  ✅ Solar Budget Allocated: ${response.body.solar_budget_allocated}`);
      passed++;
    } else {
      console.log(`  ❌ Failed: Status ${response.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    failed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nTest Results: ${passed} passed, ${failed} failed\n`);
  
  return failed === 0;
}

// Run tests if this is the main module
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
