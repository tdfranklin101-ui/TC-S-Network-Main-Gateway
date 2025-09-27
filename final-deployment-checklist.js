/**
 * The Current-See Final Deployment Checklist
 * 
 * This script verifies that all required components are ready for deployment.
 */

const fs = require('fs');
const path = require('path');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✅ SUCCESS';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Check that dollar value references have been removed
function checkDollarReferencesRemoved() {
  let allChecksPass = true;
  
  // Check global-solar-counter.js
  try {
    const counterJsPath = path.join(__dirname, 'public', 'js', 'global-solar-counter.js');
    const counterJs = fs.readFileSync(counterJsPath, 'utf8');
    
    if (counterJs.includes('DOLLARS_PER_SOLAR') || 
        counterJs.includes('formatCurrency') || 
        counterJs.includes('calculateDollarValue')) {
      log('Dollar value references still exist in global-solar-counter.js', true);
      allChecksPass = false;
    }
  } catch (err) {
    log(`Error checking global-solar-counter.js: ${err.message}`, true);
    allChecksPass = false;
  }
  
  // Check deploy-ready.js
  try {
    const deployReadyPath = path.join(__dirname, 'deploy-ready.js');
    const deployReady = fs.readFileSync(deployReadyPath, 'utf8');
    
    if (deployReady.includes('USD_PER_SOLAR')) {
      log('Dollar value references still exist in deploy-ready.js', true);
      allChecksPass = false;
    }
  } catch (err) {
    log(`Error checking deploy-ready.js: ${err.message}`, true);
    allChecksPass = false;
  }
  
  if (allChecksPass) {
    log('All dollar value references have been successfully removed');
  }
  
  return allChecksPass;
}

// Check that counter display has been fixed
function checkCounterDisplayFixed() {
  let allChecksPass = true;
  
  // Check global-solar-counter.css
  try {
    const counterCssPath = path.join(__dirname, 'public', 'css', 'global-solar-counter.css');
    const counterCss = fs.readFileSync(counterCssPath, 'utf8');
    
    if (!counterCss.includes('overflow: visible') || 
        !counterCss.includes('width: 100%')) {
      log('Counter display fixes not found in global-solar-counter.css', true);
      allChecksPass = false;
    }
  } catch (err) {
    log(`Error checking global-solar-counter.css: ${err.message}`, true);
    allChecksPass = false;
  }
  
  if (allChecksPass) {
    log('Counter display fixes have been successfully implemented');
  }
  
  return allChecksPass;
}

// Check health check endpoints
function checkHealthEndpoints() {
  let allChecksPass = true;
  
  // Check deploy-ready.js
  try {
    const deployReadyPath = path.join(__dirname, 'deploy-ready.js');
    const deployReady = fs.readFileSync(deployReadyPath, 'utf8');
    
    if (!deployReady.includes("app.get('/'") || 
        !deployReady.includes("app.get('/health'") || 
        !deployReady.includes("app.get('/healthz'")) {
      log('Health check endpoints not properly implemented in deploy-ready.js', true);
      allChecksPass = false;
    }
  } catch (err) {
    log(`Error checking health endpoints in deploy-ready.js: ${err.message}`, true);
    allChecksPass = false;
  }
  
  if (allChecksPass) {
    log('Health check endpoints are properly implemented');
  }
  
  return allChecksPass;
}

// Check static file serving
function checkStaticServing() {
  let allChecksPass = true;
  
  // Check deploy-ready.js
  try {
    const deployReadyPath = path.join(__dirname, 'deploy-ready.js');
    const deployReady = fs.readFileSync(deployReadyPath, 'utf8');
    
    if (!deployReady.includes('app.use(express.static') && 
        !deployReady.includes('app.use(serveStatic')) {
      log('Static file serving not properly implemented in deploy-ready.js', true);
      allChecksPass = false;
    }
  } catch (err) {
    log(`Error checking static file serving in deploy-ready.js: ${err.message}`, true);
    allChecksPass = false;
  }
  
  if (allChecksPass) {
    log('Static file serving is properly implemented');
  }
  
  return allChecksPass;
}

// Run all checks
function runAllChecks() {
  console.log('Running The Current-See deployment checklist...');
  console.log('---------------------------------------------');
  
  const checks = [
    { name: 'Dollar references removed', fn: checkDollarReferencesRemoved },
    { name: 'Counter display fixed', fn: checkCounterDisplayFixed },
    { name: 'Health endpoints', fn: checkHealthEndpoints },
    { name: 'Static file serving', fn: checkStaticServing }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    console.log(`\nChecking: ${check.name}`);
    const passed = check.fn();
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log('\n---------------------------------------------');
  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED: The Current-See is ready for deployment!');
    console.log('You can now proceed with the deployment process.');
  } else {
    console.log('❌ SOME CHECKS FAILED: Please address the issues above before deploying.');
  }
}

// Run the checklist
runAllChecks();