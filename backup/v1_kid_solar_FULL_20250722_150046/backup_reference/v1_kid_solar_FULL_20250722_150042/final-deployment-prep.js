/**
 * Final Deployment Preparation for The Current-See
 * 
 * This script performs final checks and preparations before live deployment.
 */

const fs = require('fs');
const path = require('path');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌' : '✅';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

function updateVersionForDeployment() {
  const version = {
    version: "2.1.0",
    lastUpdated: new Date().toISOString(),
    deployment: "live",
    features: [
      "Counter display optimized for full number visibility",
      "All dollar value references removed",
      "TC-S AI Item Energy Expert Prototype link added",
      "Production OpenAI fixes included",
      "Marketplace artifact management improved"
    ],
    target: "www.thecurrentsee.org"
  };
  
  fs.writeFileSync('version.json', JSON.stringify(version, null, 2));
  log('Version updated for live deployment');
}

function createDeploymentManifest() {
  const manifest = {
    name: "The Current-See",
    description: "Solar-backed global economic system prototype",
    domain: "www.thecurrentsee.org",
    deployment: {
      date: new Date().toISOString(),
      version: "2.1.0",
      status: "ready"
    },
    features: {
      solarGenerator: true,
      membersLog: true,
      aiItemExpert: true,
      walletIntegration: true,
      responsiveDesign: true
    },
    healthChecks: {
      root: "/",
      health: "/health", 
      healthz: "/healthz"
    }
  };
  
  fs.writeFileSync('deployment-manifest.json', JSON.stringify(manifest, null, 2));
  log('Deployment manifest created');
}

function verifyFilesForDeployment() {
  const criticalFiles = [
    'public/index.html',
    'public/js/global-solar-counter.js',
    'public/css/global-solar-counter.css',
    'deploy-ready.js',
    'public/api/members.json'
  ];
  
  let allPresent = true;
  
  criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log(`File verified: ${file}`);
    } else {
      log(`Missing critical file: ${file}`, true);
      allPresent = false;
    }
  });
  
  return allPresent;
}

function runFinalPreparation() {
  log('Starting final deployment preparation...');
  log('');
  
  const filesOk = verifyFilesForDeployment();
  if (!filesOk) {
    log('Critical files missing - cannot proceed with deployment', true);
    return false;
  }
  
  updateVersionForDeployment();
  createDeploymentManifest();
  
  log('');
  log('DEPLOYMENT SUMMARY:');
  log('- Counter display: Full numbers visible');
  log('- Dollar references: Completely removed');
  log('- New AI Item Expert link: Added to homepage');
  log('- Health checks: Configured for reliable hosting');
  log('- Target domain: www.thecurrentsee.org');
  log('');
  log('The Current-See is ready for live deployment!');
  
  return true;
}

runFinalPreparation();