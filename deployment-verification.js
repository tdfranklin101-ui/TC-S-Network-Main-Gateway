#!/usr/bin/env node
/**
 * Deployment Verification Script
 * Tests all components before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 THE CURRENT-SEE DEPLOYMENT VERIFICATION');
console.log('==========================================');

let allPassed = true;

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${description}: ${filePath}`);
  if (!exists) allPassed = false;
  return exists;
}

function checkDirectory(dirPath, description) {
  const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${description}: ${dirPath}`);
  if (!exists) allPassed = false;
  return exists;
}

// 1. Core Files Check
console.log('\n📁 CORE FILES:');
checkFile('./production-server.js', 'Production Server');
checkFile('./main.js', 'Main Server (backup)');
checkFile('./deploy-fix.js', 'Deploy Fix Server');

// 2. Website Assets Check  
console.log('\n🌐 WEBSITE ASSETS:');
checkDirectory('./deploy_v1_multimodal', 'Website Directory');
checkFile('./deploy_v1_multimodal/index.html', 'Homepage');
checkFile('./deploy_v1_multimodal/wallet.html', 'Wallet Page');
checkFile('./deploy_v1_multimodal/declaration.html', 'Declaration Page');

// 3. Check Homepage Content
console.log('\n📄 HOMEPAGE CONTENT:');
if (fs.existsSync('./deploy_v1_multimodal/index.html')) {
  const htmlContent = fs.readFileSync('./deploy_v1_multimodal/index.html', 'utf8');
  
  const checks = [
    { pattern: /Kid Solar/i, description: 'Kid Solar Integration' },
    { pattern: /did-embed/i, description: 'D-ID Agent Embed' },
    { pattern: /Music Now/i, description: 'Music Streaming Buttons' },
    { pattern: /Current-See/i, description: 'Current-See Branding' },
    { pattern: /multimodal/i, description: 'Multimodal Interface' },
    { pattern: /memory/i, description: 'Memory System Integration' },
    { pattern: /The Heart is a Mule/i, description: 'Music Track 1' },
    { pattern: /Solar Day/i, description: 'Music Tracks 2-3' },
    { pattern: /Break Time Blues/i, description: 'Music Track 4' }
  ];
  
  checks.forEach(check => {
    const found = check.pattern.test(htmlContent);
    const status = found ? '✅' : '❌';
    console.log(`${status} ${check.description}`);
    if (!found) allPassed = false;
  });
}

// 4. Server Dependencies
console.log('\n📦 SERVER DEPENDENCIES:');
try {
  require.resolve('express');
  console.log('✅ Express.js');
} catch {
  console.log('❌ Express.js');
  allPassed = false;
}

try {
  require.resolve('multer');
  console.log('✅ Multer (file uploads)');
} catch {
  console.log('❌ Multer (file uploads)');
  allPassed = false;
}

// 5. Check for Essential API Endpoints in Production Server
console.log('\n🔌 API ENDPOINTS:');
if (fs.existsSync('./production-server.js')) {
  const serverContent = fs.readFileSync('./production-server.js', 'utf8');
  
  const endpoints = [
    { pattern: /\/health/i, description: 'Health Check' },
    { pattern: /\/api\/kid-solar-analysis/i, description: 'Kid Solar Analysis' },
    { pattern: /\/api\/kid-solar-memory/i, description: 'Memory Retrieval' },
    { pattern: /\/api\/kid-solar-conversation/i, description: 'Conversation Storage' }
  ];
  
  endpoints.forEach(endpoint => {
    const found = endpoint.pattern.test(serverContent);
    const status = found ? '✅' : '❌';
    console.log(`${status} ${endpoint.description}`);
    if (!found) allPassed = false;
  });
}

// 6. Memory System Check
console.log('\n🧠 MEMORY SYSTEM:');
if (fs.existsSync('./production-server.js')) {
  const serverContent = fs.readFileSync('./production-server.js', 'utf8');
  
  const memoryChecks = [
    { pattern: /sessionMemories/i, description: 'Session Storage' },
    { pattern: /generateSessionId/i, description: 'Session ID Generation' },
    { pattern: /getSessionMemory/i, description: 'Memory Access Functions' }
  ];
  
  memoryChecks.forEach(check => {
    const found = check.pattern.test(serverContent);
    const status = found ? '✅' : '❌';
    console.log(`${status} ${check.description}`);
    if (!found) allPassed = false;
  });
}

// Final Result
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('🎉 ALL SYSTEMS READY FOR DEPLOYMENT!');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('   1. Start server: node production-server.js');
  console.log('   2. Test locally: http://localhost:3000');
  console.log('   3. Deploy to www.thecurrentsee.org');
  console.log('');
  console.log('✅ The Current-See Platform is deployment-ready!');
} else {
  console.log('❌ DEPLOYMENT VERIFICATION FAILED');
  console.log('Please fix the issues above before deploying.');
}
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);