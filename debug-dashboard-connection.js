/**
 * Dashboard Connection Debug Tool
 * Tests the connection between homepage dashboard button and analytics API
 */

const https = require('http');

console.log('🔍 DASHBOARD CONNECTION DEBUG');
console.log('=============================\n');

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

async function debugDashboard() {
  try {
    console.log('1. 🏠 Testing homepage loads...');
    const homepage = await makeRequest('http://localhost:3000/');
    console.log(`   Status: ${homepage.status}`);
    
    const dashboardLinkCount = (homepage.data.match(/\/analytics/g) || []).length;
    console.log(`   Dashboard links found: ${dashboardLinkCount}`);
    
    if (dashboardLinkCount > 0) {
      console.log('   ✅ Dashboard button exists and links to /analytics');
    } else {
      console.log('   ❌ No dashboard links to /analytics found');
    }
    
    console.log('\n2. 📊 Testing analytics page loads...');
    const analytics = await makeRequest('http://localhost:3000/analytics');
    console.log(`   Status: ${analytics.status}`);
    
    const hasLoadMemoryData = analytics.data.includes('loadMemoryData');
    const hasAPICall = analytics.data.includes('/api/kid-solar-memory/all');
    
    console.log(`   Has loadMemoryData function: ${hasLoadMemoryData ? '✅' : '❌'}`);
    console.log(`   Has API call to memory: ${hasAPICall ? '✅' : '❌'}`);
    
    console.log('\n3. 🔌 Testing memory API endpoint...');
    const api = await makeRequest('http://localhost:3000/api/kid-solar-memory/all');
    console.log(`   Status: ${api.status}`);
    
    if (api.status === 200) {
      try {
        const data = JSON.parse(api.data);
        console.log(`   ✅ API returns ${data.totalConversations} conversations`);
        console.log(`   Real conversations: ${data.realConversations}`);
        console.log(`   Test conversations: ${data.testConversations}`);
      } catch (e) {
        console.log('   ❌ API returns invalid JSON');
        console.log('   Response:', api.data.substring(0, 200));
      }
    } else {
      console.log('   ❌ API endpoint not responding correctly');
    }
    
    console.log('\n4. 🔄 Testing redirect from legacy route...');
    const redirect = await makeRequest('http://localhost:3000/ai-memory-review');
    console.log(`   Status: ${redirect.status}`);
    
    if (redirect.status === 302) {
      console.log('   ✅ Legacy route redirects correctly');
    } else if (redirect.status === 200) {
      console.log('   ⚠️  Legacy route serves content directly (should redirect)');
    } else {
      console.log('   ❌ Legacy route not working');
    }
    
    console.log('\n📋 DIAGNOSIS');
    console.log('=============');
    
    if (dashboardLinkCount > 0 && hasLoadMemoryData && hasAPICall && api.status === 200) {
      console.log('✅ All connections appear correct');
      console.log('✅ Dashboard → Analytics → API chain is properly configured');
      console.log('\nIf user sees static content, possible causes:');
      console.log('1. Browser cache - try hard refresh (Ctrl+F5)');
      console.log('2. CDN cache - may need time to update');
      console.log('3. JavaScript errors - check browser console');
    } else {
      console.log('❌ Connection issues found:');
      if (dashboardLinkCount === 0) console.log('   - Dashboard button not linking to /analytics');
      if (!hasLoadMemoryData) console.log('   - Analytics page missing loadMemoryData function');
      if (!hasAPICall) console.log('   - Analytics page not calling memory API');
      if (api.status !== 200) console.log('   - Memory API endpoint not responding');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugDashboard();