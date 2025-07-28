/**
 * Deployment Verification Script
 * Checks if hard boot cache clearing worked
 */

console.log('🔍 Verifying deployment cache clearing...');

const checkDeployment = async () => {
  try {
    // Check health endpoint
    const healthResponse = await fetch('https://www.thecurrentsee.org/health');
    const healthData = await healthResponse.json();
    
    console.log('🏥 Health Check:', healthData.status);
    
    // Check main page for hard boot markers
    const pageResponse = await fetch('https://www.thecurrentsee.org/');
    const pageContent = await pageResponse.text();
    
    // Look for hard boot indicators
    const hasHardBoot = pageContent.includes('hardboot=1753734460425');
    const hasConsoleSolar = pageContent.includes('console-solar-hardboot');
    const hasNewDescription = pageContent.includes('Console Solar - Kid Solar');
    
    console.log('🔄 Hard Boot Parameter:', hasHardBoot ? '✅ PRESENT' : '❌ MISSING');
    console.log('🎯 Console Solar Agent:', hasConsoleSolar ? '✅ PRESENT' : '❌ MISSING');
    console.log('📝 New Description:', hasNewDescription ? '✅ PRESENT' : '❌ MISSING');
    
    if (hasHardBoot && hasConsoleSolar && hasNewDescription) {
      console.log('✅ DEPLOYMENT SUCCESSFUL: Hard boot cache clearing active');
    } else {
      console.log('⚠️ DEPLOYMENT ISSUE: Cache clearing may not have taken effect');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
};

checkDeployment();