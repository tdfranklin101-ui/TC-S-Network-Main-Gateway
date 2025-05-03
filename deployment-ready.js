/**
 * The Current-See Deployment Readiness Check
 * 
 * This script checks if all the necessary components are in place
 * for a successful deployment to Replit and www.thecurrentsee.org.
 */

const fs = require('fs');
const path = require('path');

// Log a message with color
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m' // Red
  };
  
  const color = colors[type] || colors.info;
  console.log(`${color}${message}\x1b[0m`);
}

// Required files for deployment
const requiredFiles = [
  { path: './index.js', description: 'Main server implementation' },
  { path: './main.js', description: 'Compatibility wrapper for index.js' },
  { path: './Procfile', description: 'Process file for deployment' },
  { path: './run', description: 'Executable script for running the application' },
  { path: './verify-deployment.js', description: 'Script to verify deployment' },
  { path: './health-check.js', description: 'Health check implementation' },
  { path: './package.json', description: 'Node.js package configuration' },
  { path: './public/index.html', description: 'Homepage' },
  { path: './public/api/members.json', description: 'Members data file' }
];

// Check if all required files exist
function checkRequiredFiles() {
  log('Checking required files...', 'info');
  
  const missing = [];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      missing.push(file);
      log(`❌ Missing: ${file.path} (${file.description})`, 'error');
    } else {
      log(`✅ Found: ${file.path}`, 'success');
    }
  }
  
  if (missing.length === 0) {
    log('All required files are present!', 'success');
    return true;
  } else {
    log(`Missing ${missing.length} required files for deployment`, 'error');
    return false;
  }
}

// Check if package.json has the correct scripts
function checkPackageJsonScripts() {
  log('Checking package.json scripts...', 'info');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    
    // Check if start and deploy scripts exist
    if (packageJson.scripts && packageJson.scripts.start === 'node index.js') {
      log('✅ Found start script in package.json', 'success');
    } else {
      log('❌ Missing or incorrect start script in package.json', 'error');
      return false;
    }
    
    // Check deploy script
    if (packageJson.scripts && packageJson.scripts.deploy === 'node entry.js') {
      log('✅ Found deploy script in package.json', 'success');
    } else {
      log('⚠️ Deploy script may be missing or incorrect in package.json', 'warning');
    }
    
    // Check if main entry point is correct
    if (packageJson.main === 'index.js' || packageJson.main === 'main.js') {
      log(`✅ Main entry point is set to ${packageJson.main}`, 'success');
    } else {
      log(`⚠️ Main entry point is ${packageJson.main} instead of index.js or main.js`, 'warning');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error checking package.json: ${error.message}`, 'error');
    return false;
  }
}

// Check for executable permissions on the run script
function checkRunPermissions() {
  log('Checking run script permissions...', 'info');
  
  try {
    if (fs.existsSync('./run')) {
      const stats = fs.statSync('./run');
      const isExecutable = !!(stats.mode & 0o111);
      
      if (isExecutable) {
        log('✅ run script has executable permissions', 'success');
        return true;
      } else {
        log('❌ run script does not have executable permissions', 'error');
        log('   Fix with: chmod +x ./run', 'info');
        return false;
      }
    } else {
      log('❌ run script not found', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking run script permissions: ${error.message}`, 'error');
    return false;
  }
}

// Check Procfile contents
function checkProcfile() {
  log('Checking Procfile...', 'info');
  
  try {
    if (fs.existsSync('./Procfile')) {
      const content = fs.readFileSync('./Procfile', 'utf8').trim();
      
      if (content === 'web: node index.js' || content === 'web: node main.js') {
        log(`✅ Procfile contains correct command: "${content}"`, 'success');
        return true;
      } else {
        log(`❌ Procfile contains incorrect command: "${content}"`, 'error');
        log('   Should be "web: node index.js" or "web: node main.js"', 'info');
        return false;
      }
    } else {
      log('❌ Procfile not found', 'error');
      return false;
    }
  } catch (error) {
    log(`❌ Error checking Procfile: ${error.message}`, 'error');
    return false;
  }
}

// Check if the database URL environment variable is set
function checkEnvironmentVariables() {
  log('Checking environment variables...', 'info');
  
  // Check CURRENTSEE_DB_URL
  if (process.env.CURRENTSEE_DB_URL) {
    log('✅ CURRENTSEE_DB_URL is set', 'success');
  } else {
    log('⚠️ CURRENTSEE_DB_URL is not set', 'warning');
    log('   Remember to set this in Replit Secrets before deployment', 'info');
  }
  
  // Check OPENAI_API_KEY or NEW_OPENAI_API_KEY
  if (process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY) {
    log('✅ OPENAI_API_KEY or NEW_OPENAI_API_KEY is set', 'success');
  } else {
    log('⚠️ Neither OPENAI_API_KEY nor NEW_OPENAI_API_KEY is set', 'warning');
    log('   Remember to set one of these in Replit Secrets before deployment', 'info');
  }
  
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    log('✅ NODE_ENV is set to production', 'success');
  } else {
    log(`⚠️ NODE_ENV is set to ${process.env.NODE_ENV || 'undefined'} instead of production`, 'warning');
    log('   Remember to set NODE_ENV=production in Replit Secrets before deployment', 'info');
  }
  
  return true;
}

// Run all checks
function runAllChecks() {
  log('Running deployment readiness checks for The Current-See...', 'info');
  
  const results = {
    requiredFiles: checkRequiredFiles(),
    packageJsonScripts: checkPackageJsonScripts(),
    runPermissions: checkRunPermissions(),
    procfile: checkProcfile(),
    environmentVariables: checkEnvironmentVariables()
  };
  
  // Print summary
  log('\n----- DEPLOYMENT READINESS SUMMARY -----', 'info');
  
  let readyForDeployment = true;
  
  for (const [check, success] of Object.entries(results)) {
    if (!success && check !== 'environmentVariables') {
      readyForDeployment = false;
    }
  }
  
  if (readyForDeployment) {
    log('✅ All critical checks passed! The application is ready for deployment.', 'success');
    log('   Remember to set any missing environment variables in Replit Secrets before deployment.', 'info');
  } else {
    log('❌ Some critical checks failed. Please fix the issues before deployment.', 'error');
  }
  
  return readyForDeployment;
}

// Run the checks
runAllChecks();