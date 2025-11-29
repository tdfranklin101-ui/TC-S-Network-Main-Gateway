import https from 'https';
import http from 'http';

const REPLIT_PROD = process.env.REPLIT_URL || 'https://tc-s-network-main-gateway-tdfranklin101.replit.app';
const VERCEL_PROD = 'https://tc-s-network-main-gatewayv1.vercel.app';

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0 SI-Checker/1.0' }
    };
    protocol.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, status: res.statusCode }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractSolarIndex(html) {
  const patterns = [
    /"id"\s*:\s*"si"[^}]*?"value"\s*:\s*(\d+\.?\d*)/i,
    /Solar\s*Index[^0-9]*?(\d+\.?\d*)\s*%/i,
    /name.*?Solar Index.*?value.*?(\d+\.?\d*)/is,
    /SI.*?(\d{1,3}\.\d+)%/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
  }
  return null;
}

async function checkSolarIndex() {
  console.log('=== Solar Index Production Mirror Check ===\n');
  console.log(`Replit:  ${REPLIT_PROD}`);
  console.log(`Vercel:  ${VERCEL_PROD}\n`);
  
  try {
    console.log('Fetching from both sites...\n');
    
    const [replitResult, vercelResult] = await Promise.all([
      fetchURL(REPLIT_PROD).catch(e => ({ error: e.message })),
      fetchURL(VERCEL_PROD).catch(e => ({ error: e.message }))
    ]);
    
    let replitSI = null;
    let vercelSI = null;
    
    if (replitResult.error) {
      console.log(`Replit Error: ${replitResult.error}`);
    } else {
      replitSI = extractSolarIndex(replitResult.data);
      console.log(`Replit Status: ${replitResult.status}`);
    }
    
    if (vercelResult.error) {
      console.log(`Vercel Error: ${vercelResult.error}`);
    } else {
      vercelSI = extractSolarIndex(vercelResult.data);
      console.log(`Vercel Status: ${vercelResult.status}`);
    }
    
    console.log('\n--- Results ---');
    console.log(`Replit SI: ${replitSI !== null ? replitSI.toFixed(3) + '%' : 'NOT FOUND'}`);
    console.log(`Vercel SI: ${vercelSI !== null ? vercelSI.toFixed(3) + '%' : 'NOT FOUND'}`);
    
    if (replitSI !== null && vercelSI !== null) {
      const match = Math.abs(replitSI - vercelSI) < 0.001;
      console.log(`Match (3 d.p.): ${match}`);
      if (match) {
        console.log('\n✅ Both production sites are in sync!');
      } else {
        console.log(`\n⚠️ Difference: ${Math.abs(replitSI - vercelSI).toFixed(3)}%`);
      }
    } else {
      console.log('\n⚠️ Could not extract SI from one or both sites');
      if (!replitSI && replitResult.data) {
        console.log('\nReplit HTML preview (2000 chars):');
        console.log(replitResult.data.substring(0, 2000));
      }
      if (!vercelSI && vercelResult.data) {
        console.log('\nVercel HTML preview (2000 chars):');
        console.log(vercelResult.data.substring(0, 2000));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSolarIndex();
