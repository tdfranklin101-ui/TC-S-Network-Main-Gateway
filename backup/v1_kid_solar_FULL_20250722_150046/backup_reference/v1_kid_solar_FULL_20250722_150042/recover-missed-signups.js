/**
 * Signup Recovery Tool
 * 
 * This script scans the email signup logs and ensures all registered users
 * are properly added to the members data files, recovering any lost signups.
 */

const fs = require('fs');
const path = require('path');

// Import the enhanced email logger with data persistence capabilities
const emailLogger = require('./signup-email-logger');

// Configurable paths
const LOG_DIR = path.join(__dirname, 'logs');
const EMAIL_LOG_FILE = path.join(LOG_DIR, 'signup-emails.log');
const MEMBERS_JSON_PATH = path.join(__dirname, 'public', 'api', 'members.json');

/**
 * Scan email logs and ensure all signups are properly registered
 */
async function recoverSignups() {
  try {
    console.log('📋 Starting signup recovery process...');
    
    // Check if log file exists
    if (!fs.existsSync(EMAIL_LOG_FILE)) {
      console.log('⚠️ No signup log file found at:', EMAIL_LOG_FILE);
      return;
    }
    
    // Check if members.json exists
    if (!fs.existsSync(MEMBERS_JSON_PATH)) {
      console.log('⚠️ No members.json file found at:', MEMBERS_JSON_PATH);
      return;
    }
    
    // Load existing members
    const membersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
    const members = JSON.parse(membersData);
    console.log(`✓ Loaded ${members.length} members from members.json`);
    
    // Load email logs
    const logContent = fs.readFileSync(EMAIL_LOG_FILE, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Parse log entries
    const logEntries = [];
    for (const line of logLines) {
      try {
        const entry = JSON.parse(line);
        logEntries.push(entry);
      } catch (e) {
        console.log('⚠️ Skipping invalid log entry:', line.substring(0, 50) + '...');
      }
    }
    
    console.log(`✓ Loaded ${logEntries.length} signup log entries`);
    
    // Check for missing users
    let recoveredCount = 0;
    const existingEmails = new Set(members.map(m => m.email?.toLowerCase()));
    
    for (const entry of logEntries) {
      if (!entry.email) continue;
      
      const emailLower = entry.email.toLowerCase();
      // If this email is not already in members.json, add it
      if (!existingEmails.has(emailLower)) {
        console.log(`🔄 Recovering signup for ${entry.name} (${entry.email})`);
        // Use the ensureDataPersistence function from the enhanced email logger
        const result = emailLogger.logSignup(entry);
        if (result) {
          recoveredCount++;
        }
        // Avoid duplicate processing
        existingEmails.add(emailLower);
      }
    }
    
    console.log(`✅ Recovery process completed: ${recoveredCount} signups recovered`);
    
    // If we recovered any signups, verify the members file again
    if (recoveredCount > 0) {
      const updatedMembersData = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
      const updatedMembers = JSON.parse(updatedMembersData);
      console.log(`Current member count: ${updatedMembers.length} (after recovery)`);
    }
  } catch (error) {
    console.error('❌ Error in recovery process:', error);
  }
}

// Execute the recovery process
recoverSignups().catch(err => {
  console.error('Fatal error during recovery:', err);
  process.exit(1);
});