/**
 * The Current-See Deployment Finalization
 * 
 * This script performs final preparation for a production deployment:
 * 1. Runs system checks to verify all components are working
 * 2. Updates version information
 * 3. Configures feature flags
 * 4. Sets up proper logging
 * 5. Verifies database connection
 * 6. Prepares restart for production mode
 * 
 * Usage: node deploy-finalize.js [version]
 * Example: node deploy-finalize.js 1.2.1
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

// Convert exec to promise-based
const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  // Deployment files
  deploymentServer: 'pure-deployment.js',
  features: ['solarClock', 'database', 'openai', 'distributionSystem'],
  configFiles: [
    '.env.openai',
    'features.json'
  ],
  // Default version if none provided
  defaultVersion: '1.2.1',
  defaultBuild: new Date().toISOString().split('T')[0].replace(/-/g, '.')
};

/**
 * Log a message with color
 */
function log(message, type = 'info') {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
  };
  
  let color = colors.reset;
  switch (type) {
    case 'error':
      color = colors.red;
      break;
    case 'warning':
      color = colors.yellow;
      break;
    case 'success':
      color = colors.green;
      break;
    case 'header':
      color = colors.bright + colors.cyan;
      break;
    default:
      color = colors.reset;
  }
  
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Run system check
 */
async function runSystemCheck() {
  log('\n► Running system check...', 'header');
  
  try {
    // Run system check script
    const { stdout, stderr } = await execAsync('node system-check.js');
    
    // Check if there were any failures
    if (stderr && stderr.includes('FAIL')) {
      log('System check detected failures:', 'error');
      log(stderr);
      return false;
    }
    
    // Check if there were warnings
    if (stdout.includes('WARNINGS')) {
      log('System check completed with warnings:', 'warning');
      const warningLines = stdout.split('\n').filter(line => line.includes('⚠'));
      warningLines.forEach(line => log(line, 'warning'));
    } else {
      log('System check completed successfully', 'success');
    }
    
    return true;
  } catch (err) {
    log(`Error running system check: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Update version information
 */
async function updateVersion(version) {
  log('\n► Updating version information...', 'header');
  
  const versionToUse = version || CONFIG.defaultVersion;
  const buildToUse = CONFIG.defaultBuild;
  
  try {
    if (fs.existsSync(CONFIG.deploymentServer)) {
      let content = fs.readFileSync(CONFIG.deploymentServer, 'utf8');
      
      // Find APP_VERSION constant in the file
      const versionMatch = content.match(/APP_VERSION\s*=\s*{[^}]+}/);
      if (versionMatch) {
        // Extract the current version object
        const currentVersionStr = versionMatch[0];
        
        // Create a new version string
        const newVersionStr = `APP_VERSION = {
  name: "The Current-See Pure Deployment Server",
  version: "${versionToUse}",
  build: "${buildToUse}"
}`;
        
        // Replace the version object
        content = content.replace(currentVersionStr, newVersionStr);
        
        // Write back to file
        fs.writeFileSync(CONFIG.deploymentServer, content, 'utf8');
        
        log(`Version updated to ${versionToUse} (Build ${buildToUse})`, 'success');
        return true;
      } else {
        log('APP_VERSION constant not found in deployment server file', 'error');
        return false;
      }
    } else {
      log(`Deployment server file not found: ${CONFIG.deploymentServer}`, 'error');
      return false;
    }
  } catch (err) {
    log(`Error updating version: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Set feature flags
 */
async function setFeatureFlags() {
  log('\n► Configuring feature flags...', 'header');
  
  try {
    // Create features object
    const features = {};
    CONFIG.features.forEach(feature => {
      features[feature] = true;
    });
    
    // Write to features.json
    fs.writeFileSync('features.json', JSON.stringify(features, null, 2), 'utf8');
    
    log('Feature flags configured:', 'success');
    Object.entries(features).forEach(([key, value]) => {
      log(`  - ${key}: ${value ? 'enabled' : 'disabled'}`);
    });
    
    return true;
  } catch (err) {
    log(`Error configuring features: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Check for configuration files
 */
async function checkConfigFiles() {
  log('\n► Checking configuration files...', 'header');
  
  let allFilesPresent = true;
  
  for (const file of CONFIG.configFiles) {
    if (fs.existsSync(file)) {
      log(`✓ Found: ${file}`);
    } else {
      log(`✗ Missing: ${file}`, 'error');
      allFilesPresent = false;
    }
  }
  
  return allFilesPresent;
}

/**
 * Run a final verification of components
 */
async function runComponentTests() {
  log('\n► Running component tests...', 'header');
  
  // Check OpenAI connection
  try {
    log('Testing OpenAI connection...');
    const { stdout, stderr } = await execAsync('node test-openai-connection.js');
    
    if (stderr) {
      log('OpenAI connection test encountered errors:', 'error');
      log(stderr);
    } else if (stdout.includes('SUCCESS: Connection test successful')) {
      log('OpenAI connection verified', 'success');
    } else {
      log('OpenAI connection test returned unclear results', 'warning');
    }
  } catch (err) {
    log(`Error testing OpenAI connection: ${err.message}`, 'error');
  }
  
  // Test product analysis
  try {
    log('Testing AI product analysis...');
    const { stdout, stderr } = await execAsync('node test-product-analysis.js');
    
    if (stderr) {
      log('AI product analysis test encountered errors:', 'error');
      log(stderr);
    } else if (stdout.includes('Product analysis test successful')) {
      log('AI product analysis verified', 'success');
    } else {
      log('AI product analysis test returned unclear results', 'warning');
    }
  } catch (err) {
    log(`Error testing AI product analysis: ${err.message}`, 'error');
  }
  
  // Test database connection
  try {
    log('Testing database connection...');
    if (fs.existsSync('check-currentsee-db.js')) {
      const { stdout, stderr } = await execAsync('node check-currentsee-db.js');
      
      if (stderr) {
        log('Database connection test encountered errors:', 'error');
        log(stderr);
      } else if (stdout.includes('Database connection successful')) {
        log('Database connection verified', 'success');
      } else {
        log('Database connection test returned unclear results', 'warning');
      }
    } else {
      log('Database connection test script not found', 'warning');
    }
  } catch (err) {
    log(`Error testing database connection: ${err.message}`, 'error');
  }
}

/**
 * Run the entire finalization process
 */
async function runFinalization() {
  const version = process.argv[2] || CONFIG.defaultVersion;
  
  log('\n===============================================');
  log('  THE CURRENT-SEE DEPLOYMENT FINALIZATION', 'header');
  log('===============================================\n');
  
  log(`Version: ${version}`);
  log(`Date: ${new Date().toISOString()}`);
  
  // Run system check
  const systemCheckResult = await runSystemCheck();
  
  // Update version information
  const versionUpdateResult = await updateVersion(version);
  
  // Set feature flags
  const featureFlagsResult = await setFeatureFlags();
  
  // Check config files
  const configFilesResult = await checkConfigFiles();
  
  // Run component tests
  await runComponentTests();
  
  // Show summary
  log('\n► Finalization Summary', 'header');
  log(`System check: ${systemCheckResult ? 'Passed ✓' : 'Failed ✗'}`);
  log(`Version update: ${versionUpdateResult ? 'Completed ✓' : 'Failed ✗'}`);
  log(`Feature flags: ${featureFlagsResult ? 'Configured ✓' : 'Failed ✗'}`);
  log(`Config files: ${configFilesResult ? 'All present ✓' : 'Some missing ✗'}`);
  
  // Determine overall status
  const overallSuccess = systemCheckResult && versionUpdateResult && 
                         featureFlagsResult && configFilesResult;
  
  if (overallSuccess) {
    log('\n✓ Deployment finalization completed successfully!', 'success');
    log('The Current-See application is ready for production deployment.', 'success');
    log('\nTo start the production server:');
    log('  node restart-server.js');
  } else {
    log('\n✗ Deployment finalization encountered issues!', 'error');
    log('Please fix the identified issues before proceeding with deployment.', 'error');
  }
  
  log('\n===============================================');
  
  return overallSuccess;
}

// Run the finalization process
runFinalization()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    log(`Unexpected error: ${err.message}`, 'error');
    process.exit(1);
  });