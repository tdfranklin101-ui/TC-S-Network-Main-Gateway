/**
 * The Current-See - Check Solar Distribution Status
 * 
 * This script checks the status of the SOLAR distribution system and provides
 * information about the next scheduled distribution.
 * 
 * Usage: node check-solar-distribution.js
 */

const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

/**
 * Format date for human-readable output
 */
function formatDate(date) {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short'
  });
}

/**
 * Check if the required API keys are available
 */
function checkApiKeys() {
  console.log(`${colors.bold}Checking API Keys:${colors.reset}`);
  
  const openaiKeyAvailable = !!process.env.OPENAI_API_KEY || !!process.env.NEW_OPENAI_API_KEY;
  console.log(`${openaiKeyAvailable ? colors.green + '✓' : colors.red + '✗'} OpenAI API Key: ${openaiKeyAvailable ? 'Available' : 'Not available'}`);
  
  if (!openaiKeyAvailable) {
    console.log(`${colors.yellow}Note: Without OpenAI API key, the system will fall back to standard distribution.${colors.reset}`);
  }
  
  return openaiKeyAvailable;
}

/**
 * Check the distribution log file for recent activity
 */
function checkDistributionLog() {
  console.log(`\n${colors.bold}Checking Distribution Log:${colors.reset}`);
  
  const logFile = 'distribution_log.txt';
  
  if (!fs.existsSync(logFile)) {
    console.log(`${colors.red}✗ Distribution log file not found.${colors.reset}`);
    return false;
  }
  
  const logContent = fs.readFileSync(logFile, 'utf8');
  const logLines = logContent.split('\n').filter(line => line.trim());
  
  if (logLines.length === 0) {
    console.log(`${colors.yellow}! Distribution log file exists but is empty.${colors.reset}`);
    return false;
  }
  
  // Get the 5 most recent log entries
  const recentEntries = logLines.slice(-5);
  
  console.log(`${colors.green}✓ Distribution log file found with ${logLines.length} entries.${colors.reset}`);
  console.log(`${colors.cyan}Recent activity:${colors.reset}`);
  
  recentEntries.forEach(entry => {
    console.log(`  ${entry}`);
  });
  
  // Check for any errors in recent entries
  const hasRecentErrors = recentEntries.some(entry => entry.toLowerCase().includes('error') || entry.toLowerCase().includes('fail'));
  
  if (hasRecentErrors) {
    console.log(`${colors.yellow}! Recent errors detected in log file. Check for issues.${colors.reset}`);
  }
  
  return true;
}

/**
 * Check the members data for distribution status
 */
function checkMembersData() {
  console.log(`\n${colors.bold}Checking Members Data:${colors.reset}`);
  
  const membersFile = 'public/api/members.json';
  
  if (!fs.existsSync(membersFile)) {
    console.log(`${colors.red}✗ Members data file not found.${colors.reset}`);
    return false;
  }
  
  try {
    const membersData = JSON.parse(fs.readFileSync(membersFile, 'utf8'));
    
    if (!Array.isArray(membersData) || membersData.length === 0) {
      console.log(`${colors.yellow}! Members data file exists but contains no members.${colors.reset}`);
      return false;
    }
    
    // Filter out the reserve account
    const activeMembers = membersData.filter(member => !member.isReserve);
    
    console.log(`${colors.green}✓ Members data file found with ${activeMembers.length} active members.${colors.reset}`);
    
    // Check a few sample members
    console.log(`${colors.cyan}Sample members:${colors.reset}`);
    
    // Try to find specific members of interest
    const terryFranklin = membersData.find(m => m.name === 'Terry D. Franklin');
    const johnD = membersData.find(m => m.name === 'John D');
    
    if (terryFranklin) {
      console.log(`  Member #${terryFranklin.id}: ${terryFranklin.name}`);
      console.log(`    Join Date: ${new Date(terryFranklin.joined_date || terryFranklin.joinedDate).toDateString()}`);
      const solarAmount = terryFranklin.total_solar || terryFranklin.totalSolar || 0;
      console.log(`    SOLAR Amount: ${parseFloat(solarAmount).toFixed(4)}`);
    }
    
    if (johnD) {
      console.log(`  Member #${johnD.id}: ${johnD.name}`);
      console.log(`    Join Date: ${new Date(johnD.joined_date || johnD.joinedDate).toDateString()}`);
      const solarAmount = johnD.total_solar || johnD.totalSolar || 0;
      console.log(`    SOLAR Amount: ${parseFloat(solarAmount).toFixed(4)}`);
    }
    
    // Show a couple more random members
    if (!terryFranklin && !johnD && activeMembers.length > 0) {
      const randomMember = activeMembers[Math.floor(Math.random() * activeMembers.length)];
      console.log(`  Member #${randomMember.id}: ${randomMember.name}`);
      console.log(`    Join Date: ${new Date(randomMember.joined_date || randomMember.joinedDate).toDateString()}`);
      const solarAmount = randomMember.total_solar || randomMember.totalSolar || 0;
      console.log(`    SOLAR Amount: ${parseFloat(solarAmount).toFixed(4)}`);
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Error parsing members data: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Check the next scheduled distribution time
 */
function checkNextDistribution() {
  console.log(`\n${colors.bold}Checking Next Distribution Time:${colors.reset}`);
  
  try {
    // Create a temporary job using the same schedule as the actual distribution
    const tempJob = schedule.scheduleJob('0 17 * * *', function() {
      // This is a dummy function that won't actually run
    });
    
    if (!tempJob || !tempJob.nextInvocation()) {
      console.log(`${colors.yellow}! Could not determine next distribution time.${colors.reset}`);
      return false;
    }
    
    const nextDistributionTime = tempJob.nextInvocation();
    
    // Format the time in different ways
    const formattedTime = formatDate(nextDistributionTime);
    const now = new Date();
    const timeUntil = nextDistributionTime.getTime() - now.getTime();
    const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
    const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`${colors.green}✓ Next distribution scheduled for:${colors.reset}`);
    console.log(`  ${colors.cyan}${formattedTime}${colors.reset}`);
    console.log(`  ${colors.cyan}Time until next distribution: ${hoursUntil} hours, ${minutesUntil} minutes${colors.reset}`);
    
    // Cancel the temporary job
    tempJob.cancel();
    
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Error checking next distribution time: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Check if automatic website update system is working
 */
function checkAutomaticUpdateSystem() {
  console.log(`\n${colors.bold}Checking Automatic Website Update System:${colors.reset}`);
  
  // Check for the cache timestamp file
  const cacheTimestampFile = 'public/cache-timestamp.txt';
  if (!fs.existsSync(cacheTimestampFile)) {
    console.log(`${colors.red}✗ Cache timestamp file not found. Auto-update system may not be working.${colors.reset}`);
    return false;
  }
  
  try {
    const timestampContent = fs.readFileSync(cacheTimestampFile, 'utf8').trim();
    const timestamp = new Date(timestampContent);
    
    if (isNaN(timestamp.getTime())) {
      console.log(`${colors.yellow}! Cache timestamp file exists but contains invalid date.${colors.reset}`);
      return false;
    }
    
    const timeSinceUpdate = new Date() - timestamp;
    const minutesSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60));
    
    console.log(`${colors.green}✓ Cache timestamp file found and valid:${colors.reset}`);
    console.log(`  ${colors.cyan}Last updated: ${formatDate(timestamp)}${colors.reset}`);
    console.log(`  ${colors.cyan}Time since last update: ${minutesSinceUpdate} minutes${colors.reset}`);
    
    // Check if auto-update scripts are present
    const cacheBusterScript = 'public/js/cache-buster.js';
    const membersLogScript = 'public/js/public-members-log.js';
    const solarRefreshScript = 'public/js/solar-generator-refresh.js';
    
    const hasAllScripts = fs.existsSync(cacheBusterScript) && 
                         fs.existsSync(membersLogScript) && 
                         fs.existsSync(solarRefreshScript);
    
    if (hasAllScripts) {
      console.log(`${colors.green}✓ All auto-update scripts are in place.${colors.reset}`);
    } else {
      console.log(`${colors.yellow}! Some auto-update scripts are missing:${colors.reset}`);
      console.log(`  ${fs.existsSync(cacheBusterScript) ? colors.green + '✓' : colors.red + '✗'} Cache buster script${colors.reset}`);
      console.log(`  ${fs.existsSync(membersLogScript) ? colors.green + '✓' : colors.red + '✗'} Members log script${colors.reset}`);
      console.log(`  ${fs.existsSync(solarRefreshScript) ? colors.green + '✓' : colors.red + '✗'} Solar generator refresh script${colors.reset}`);
    }
    
    // Check for sync log
    const syncLogFile = 'sync_log.txt';
    if (fs.existsSync(syncLogFile)) {
      const syncLogContent = fs.readFileSync(syncLogFile, 'utf8');
      const syncLogLines = syncLogContent.split('\n').filter(line => line.trim());
      
      if (syncLogLines.length > 0) {
        console.log(`${colors.green}✓ Sync log file found with ${syncLogLines.length} entries.${colors.reset}`);
        console.log(`${colors.cyan}Recent sync activity:${colors.reset}`);
        
        // Show the 3 most recent sync log entries
        syncLogLines.slice(-3).forEach(entry => {
          console.log(`  ${entry}`);
        });
      } else {
        console.log(`${colors.yellow}! Sync log file exists but is empty.${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}! Sync log file not found. File sync system may not have run yet.${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Error checking auto-update system: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main function - run all checks
 */
function main() {
  console.log(`${colors.bold}${colors.cyan}The Current-See Solar Distribution Status Check${colors.reset}`);
  console.log(`${colors.cyan}Running on: ${formatDate(new Date())}${colors.reset}`);
  console.log('─'.repeat(60));
  
  // Run all checks
  const apiKeysOk = checkApiKeys();
  const logOk = checkDistributionLog();
  const membersOk = checkMembersData();
  const nextDistOk = checkNextDistribution();
  const autoUpdateOk = checkAutomaticUpdateSystem();
  
  console.log('\n' + '─'.repeat(60));
  console.log(`${colors.bold}${colors.cyan}Summary:${colors.reset}`);
  console.log(`${apiKeysOk ? colors.green + '✓' : colors.yellow + '!'} API Keys: ${apiKeysOk ? 'Available' : 'Fallback mode'}`);
  console.log(`${logOk ? colors.green + '✓' : colors.red + '✗'} Distribution Log: ${logOk ? 'OK' : 'Issue detected'}`);
  console.log(`${membersOk ? colors.green + '✓' : colors.red + '✗'} Members Data: ${membersOk ? 'OK' : 'Issue detected'}`);
  console.log(`${nextDistOk ? colors.green + '✓' : colors.yellow + '!'} Next Distribution: ${nextDistOk ? 'Scheduled' : 'Could not determine'}`);
  console.log(`${autoUpdateOk ? colors.green + '✓' : colors.yellow + '!'} Auto-Update System: ${autoUpdateOk ? 'Active' : 'May need attention'}`);
  
  const overallStatus = apiKeysOk && logOk && membersOk && nextDistOk && autoUpdateOk;
  
  console.log('\n' + '─'.repeat(60));
  if (overallStatus) {
    console.log(`${colors.green}${colors.bold}✓ All systems are functioning correctly.${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bold}! Some issues were detected. Review the logs for details.${colors.reset}`);
  }
  
  process.exit(overallStatus ? 0 : 1);
}

// Run the main function
main();