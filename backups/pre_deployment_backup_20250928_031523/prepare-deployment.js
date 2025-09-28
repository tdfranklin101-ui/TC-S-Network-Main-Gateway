/**
 * The Current-See Deployment Preparation
 * 
 * This script prepares the application for deployment by:
 * 1. Checking critical files
 * 2. Syncing members data
 * 3. Updating embedded-members file
 * 4. Checking database connection
 * 5. Creating backup files
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Log a message with color
function log(message, color = colors.cyan) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Run a shell command and return its output
async function runCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      log(`Command produced warnings: ${stderr}`, colors.yellow);
    }
    return stdout.trim();
  } catch (error) {
    log(`Command failed: ${error.message}`, colors.red);
    return null;
  }
}

// Critical files that must exist
const criticalFiles = [
  'main.js',
  'public/api/members.json',
  'public/embedded-members',
  'public/solar-generator.html',
  'public/js/public-members-log.js',
  'public/js/real_time_solar_counter.js'
];

// Check if critical files exist
async function checkCriticalFiles() {
  log('Checking critical files...', colors.blue);
  
  const missingFiles = [];
  
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      log(`✓ File exists: ${file}`, colors.green);
    } else {
      log(`✗ Missing critical file: ${file}`, colors.red);
      missingFiles.push(file);
    }
  }
  
  return missingFiles.length === 0;
}

// Create backup of critical files
async function createBackups() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupDir = `backup/deployment_${timestamp}`;
  
  log(`Creating backup in ${backupDir}...`, colors.blue);
  
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    
    for (const file of criticalFiles) {
      if (fs.existsSync(file)) {
        const destDir = path.join(backupDir, path.dirname(file));
        fs.mkdirSync(destDir, { recursive: true });
        
        const destFile = path.join(backupDir, file);
        fs.copyFileSync(file, destFile);
        
        log(`✓ Backed up: ${file}`, colors.green);
      }
    }
    
    return true;
  } catch (error) {
    log(`Error creating backups: ${error.message}`, colors.red);
    return false;
  }
}

// Update embedded-members file from members.json
async function updateEmbeddedMembers() {
  log('Updating embedded-members file...', colors.blue);
  
  try {
    if (!fs.existsSync('public/api/members.json')) {
      log('Cannot update embedded-members: members.json not found', colors.red);
      return false;
    }
    
    const membersData = fs.readFileSync('public/api/members.json', 'utf8');
    const members = JSON.parse(membersData);
    
    fs.writeFileSync('public/embedded-members', `const EMBEDDED_MEMBERS = ${membersData};`);
    
    log(`✓ Updated embedded-members with ${members.length} members`, colors.green);
    return true;
  } catch (error) {
    log(`Error updating embedded-members: ${error.message}`, colors.red);
    return false;
  }
}

// Sync members between JSON file and database
async function syncMembersToDatabase() {
  log('Syncing members data to database...', colors.blue);
  
  try {
    const result = await runCommand('node sync-members-to-db.js');
    return result && result.includes('Sync completed successfully');
  } catch (error) {
    log(`Error syncing members: ${error.message}`, colors.red);
    return false;
  }
}

// Check database connection
async function checkDatabaseConnection() {
  log('Checking database connection...', colors.blue);
  
  try {
    const result = await runCommand('node check-currentsee-db.js');
    return result && result.includes('Connection successful');
  } catch (error) {
    log(`Error checking database: ${error.message}`, colors.red);
    return false;
  }
}

// Run header/footer fix script
async function fixHeaderFooter() {
  log('Fixing header/footer includes...', colors.blue);
  
  try {
    const result = await runCommand('node fix-header-footer.js');
    log('Header/footer fix completed', colors.green);
    return true;
  } catch (error) {
    log(`Error fixing header/footer: ${error.message}`, colors.red);
    return false;
  }
}

// Main function to run all preparation steps
async function prepareForDeployment() {
  log('=== STARTING DEPLOYMENT PREPARATION ===', colors.white);
  
  // Step 1: Create backups
  const backupSuccess = await createBackups();
  if (!backupSuccess) {
    log('Warning: Backup creation failed, but continuing preparation', colors.yellow);
  }
  
  // Step 2: Check critical files
  const filesOk = await checkCriticalFiles();
  if (!filesOk) {
    log('Critical files check failed. Cannot proceed with deployment.', colors.red);
    return false;
  }
  
  // Step 3: Update embedded members
  const embeddedSuccess = await updateEmbeddedMembers();
  if (!embeddedSuccess) {
    log('Failed to update embedded members file. Cannot proceed.', colors.red);
    return false;
  }
  
  // Step 4: Sync members to database
  const syncSuccess = await syncMembersToDatabase();
  if (!syncSuccess) {
    log('Failed to sync members to database. Cannot proceed.', colors.red);
    return false;
  }
  
  // Step 5: Check database connection
  const dbSuccess = await checkDatabaseConnection();
  if (!dbSuccess) {
    log('Database connection check failed. Cannot proceed.', colors.red);
    return false;
  }
  
  // Step 6: Fix header/footer includes
  const headerFooterSuccess = await fixHeaderFooter();
  if (!headerFooterSuccess) {
    log('Warning: Header/footer fix failed, but continuing preparation', colors.yellow);
  }
  
  // Final check - get application version
  try {
    const versionModule = require('./main.js');
    if (versionModule.APP_VERSION) {
      log(`Current application version: ${versionModule.APP_VERSION.version} (Build ${versionModule.APP_VERSION.build})`, colors.cyan);
    }
  } catch (error) {
    log('Warning: Could not determine application version', colors.yellow);
  }
  
  // All checks passed
  log('=== DEPLOYMENT PREPARATION COMPLETE ===', colors.green);
  log('The application is ready for deployment!', colors.green);
  return true;
}

// Run the preparation
prepareForDeployment().then(success => {
  if (!success) {
    log('Deployment preparation failed. Please fix the issues and try again.', colors.red);
    process.exit(1);
  }
});