// Deployment monitoring script for Current-See
const http = require('http');

function checkDeployment() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log(`✅ Server healthy: ${health.service} ${health.version}`);
        console.log(`👦 Kid Solar: ${health.kidSolar}`);
        console.log(`⏰ Timestamp: ${health.timestamp}`);
      } catch (e) {
        console.log('✅ Server responding:', data.substring(0, 100));
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Server not responding:', e.message);
  });

  req.on('timeout', () => {
    console.log('⏱️ Health check timeout');
    req.destroy();
  });

  req.end();
}

// Check immediately and then every 30 seconds
checkDeployment();
setInterval(checkDeployment, 30000);

console.log('🚀 Monitoring Current-See deployment status...');