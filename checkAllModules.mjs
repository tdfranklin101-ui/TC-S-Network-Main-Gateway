/**
 * TC-S Network - 14-Module Deployment Verification
 * Checks all 14 repositories for Vercel deployment status
 */

const MODULES = [
  {
    id: 1,
    name: 'TC-S-Network-Main-Gateway',
    type: 'Command Center',
    vercelUrl: 'https://tc-s-network-main-gatewayv1.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 2,
    name: 'TC-S-Network-Wallet',
    type: 'Solar Wallet',
    vercelUrl: 'https://tc-s-network-wallet.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 3,
    name: 'TC-S-Network-Market-Grid',
    type: 'Marketplace',
    vercelUrl: 'https://tc-s-network-market-grid.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 4,
    name: 'TC-S-Network-SolarStack',
    type: 'Energy Calculations',
    vercelUrl: 'https://tc-s-network-solar-stack.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 5,
    name: 'TC-S-Network-Indices',
    type: 'Daily Indices',
    vercelUrl: 'https://tc-s-network-indices.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 6,
    name: 'TC-S-Network-Satellite-ID',
    type: 'Satellite Tracking',
    vercelUrl: 'https://tc-s-network-satellite-id.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 7,
    name: 'TC-S-Network-Seismic-ID',
    type: 'Earthquake Monitoring',
    vercelUrl: 'https://tc-s-network-seismic-id.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 8,
    name: 'TC-S-Network-Identify-Anything',
    type: 'Universal ID API',
    vercelUrl: 'https://tc-s-network-identify-anything.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 9,
    name: 'TC-S-Network-Z-Private',
    type: 'Private Operations',
    vercelUrl: 'https://tc-s-network-z-private.vercel.app',
    healthEndpoint: '/health',
    private: true
  },
  {
    id: 10,
    name: 'TC-S-Network-Compute',
    type: 'Power Twin',
    vercelUrl: 'https://tc-s-network-compute.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 11,
    name: 'TC-S-Network-Apps',
    type: 'App Integrations',
    vercelUrl: 'https://tc-s-network-apps.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 12,
    name: 'TC-S-Network-Licensing',
    type: 'Content Licensing',
    vercelUrl: 'https://tc-s-network-licensing.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 13,
    name: 'TC-S-Network-Grid',
    type: 'Energy Grid',
    vercelUrl: 'https://tc-s-network-grid.vercel.app',
    healthEndpoint: '/health'
  },
  {
    id: 14,
    name: 'TC-S-Network-ReserveTracker',
    type: 'Solar Reserve',
    vercelUrl: 'https://tc-s-network-reserve-tracker.vercel.app',
    healthEndpoint: '/health'
  }
];

async function checkModule(module) {
  const startTime = Date.now();
  
  try {
    // Try health endpoint first
    let response = await fetch(module.vercelUrl + module.healthEndpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    
    // If health fails, try root
    if (!response.ok) {
      response = await fetch(module.vercelUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
    }
    
    const latency = Date.now() - startTime;
    
    return {
      ...module,
      status: response.ok ? 'online' : 'error',
      httpStatus: response.status,
      latency,
      error: null
    };
  } catch (error) {
    return {
      ...module,
      status: 'offline',
      httpStatus: null,
      latency: Date.now() - startTime,
      error: error.message
    };
  }
}

async function verifyAllModules() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        TC-S Network - 14-Module Vercel Deployment Check          ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Timestamp: ${new Date().toISOString().padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Checking all 14 modules...\n');
  
  const results = await Promise.all(MODULES.map(checkModule));
  
  let online = 0;
  let offline = 0;
  let errors = 0;
  
  console.log('┌────┬────────────────────────────────────┬────────────────────┬──────────┬─────────┐');
  console.log('│ #  │ Module                             │ Type               │ Status   │ Latency │');
  console.log('├────┼────────────────────────────────────┼────────────────────┼──────────┼─────────┤');
  
  for (const result of results) {
    let statusIcon;
    if (result.status === 'online') {
      statusIcon = '🟢 Online';
      online++;
    } else if (result.status === 'offline') {
      statusIcon = '🔴 Offline';
      offline++;
    } else {
      statusIcon = '🟡 Error';
      errors++;
    }
    
    const id = String(result.id).padStart(2);
    const name = result.name.substring(0, 34).padEnd(34);
    const type = result.type.substring(0, 18).padEnd(18);
    const latency = result.latency ? `${result.latency}ms`.padStart(6) : 'N/A'.padStart(6);
    
    console.log(`│ ${id} │ ${name} │ ${type} │ ${statusIcon.padEnd(8)} │ ${latency} │`);
  }
  
  console.log('└────┴────────────────────────────────────┴────────────────────┴──────────┴─────────┘\n');
  
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                          SUMMARY                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  🟢 Online:  ${String(online).padStart(2)}/14                                               ║`);
  console.log(`║  🔴 Offline: ${String(offline).padStart(2)}/14                                               ║`);
  console.log(`║  🟡 Errors:  ${String(errors).padStart(2)}/14                                               ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  
  if (online === 14) {
    console.log('║  ✅ ALL 14 MODULES DEPLOYED AND OPERATIONAL                      ║');
  } else if (online >= 10) {
    console.log('║  ⚠️  PARTIAL DEPLOYMENT - Some modules need attention            ║');
  } else {
    console.log('║  ❌ CRITICAL - Multiple modules offline                          ║');
  }
  
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  // Show offline modules details
  const offlineModules = results.filter(r => r.status !== 'online');
  if (offlineModules.length > 0) {
    console.log('Offline/Error Module Details:');
    console.log('─'.repeat(70));
    for (const m of offlineModules) {
      console.log(`  ${m.id}. ${m.name}`);
      console.log(`     URL: ${m.vercelUrl}`);
      console.log(`     Error: ${m.error || 'HTTP ' + m.httpStatus}`);
      if (m.private) {
        console.log('     Note: This is a PRIVATE repository');
      }
      console.log('');
    }
  }
  
  return { online, offline, errors, results };
}

verifyAllModules();
