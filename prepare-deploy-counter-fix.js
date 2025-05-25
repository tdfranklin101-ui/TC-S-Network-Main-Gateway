/**
 * The Current-See Counter Display Fix Deployment Preparation
 * 
 * This script prepares the application for deployment with the counter display fix
 * to ensure all numerical values are fully visible.
 */

const fs = require('fs');
const path = require('path');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✅ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
  
  // Also append to deployment log
  fs.appendFileSync('deploy.log', `[${timestamp}] ${prefix}: ${message}\n`);
}

function backupFile(filePath) {
  const backupPath = `${filePath}.bak.${Date.now()}`;
  try {
    fs.copyFileSync(filePath, backupPath);
    log(`Created backup of ${filePath} at ${backupPath}`);
    return true;
  } catch (err) {
    log(`Failed to create backup of ${filePath}: ${err.message}`, true);
    return false;
  }
}

function verifyCounterStyling() {
  const cssPath = path.join('public', 'css', 'global-solar-counter.css');
  
  try {
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    // Check if our styling changes are applied
    if (!cssContent.includes('word-break: keep-all') || 
        !cssContent.includes('width: 100%') ||
        !cssContent.includes('max-width: 100%')) {
      
      log('Counter styling needs to be updated for full number visibility', true);
      return false;
    }
    
    log('Counter styling verified - numbers will display correctly');
    return true;
  } catch (err) {
    log(`Failed to verify counter styling: ${err.message}`, true);
    return false;
  }
}

function verifyCounterFormatting() {
  const jsPath = path.join('public', 'js', 'global-solar-counter.js');
  
  try {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Check if our formatting changes are applied
    if (!jsContent.includes('toLocaleString') || 
        jsContent.includes('DOLLARS_PER_SOLAR')) {
      
      log('Counter formatting needs to be updated for proper display', true);
      return false;
    }
    
    log('Counter formatting verified - all dollar references removed');
    return true;
  } catch (err) {
    log(`Failed to verify counter formatting: ${err.message}`, true);
    return false;
  }
}

function prepareForDeployment() {
  log('Starting deployment preparation with counter display fixes');
  
  // Verify our fixes are in place
  const stylingOk = verifyCounterStyling();
  const formattingOk = verifyCounterFormatting();
  
  if (!stylingOk || !formattingOk) {
    log('Some counter display fixes are missing - please run the fix scripts first', true);
    return false;
  }
  
  // Update version information if needed
  try {
    const versionFile = 'version.json';
    if (fs.existsSync(versionFile)) {
      const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      versionData.lastUpdated = new Date().toISOString();
      versionData.changes = versionData.changes || [];
      versionData.changes.push({
        date: new Date().toISOString(),
        description: "Fixed counter display to ensure full numerical values are visible"
      });
      fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
      log('Updated version information');
    }
  } catch (err) {
    log(`Failed to update version information: ${err.message}`, true);
  }
  
  log('Deployment preparation completed successfully');
  log('The application is ready for deployment with counter display fixes');
  
  return true;
}

// Run the preparation
const success = prepareForDeployment();
if (success) {
  log('✨ The Current-See is ready for deployment with counter display fixes ✨');
  log('You can now proceed with deployment');
} else {
  log('❌ Deployment preparation failed - please address the issues above', true);
}