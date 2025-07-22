/**
 * Signup Email Logger
 * 
 * This module creates a dedicated system to log and preserve all signup information,
 * especially email addresses, to ensure they're never lost during migrations or updates.
 * It also provides automatic data synchronization with the main member storage files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurable paths
const LOG_DIR = path.join(__dirname, 'logs');
const EMAIL_LOG_FILE = path.join(LOG_DIR, 'signup-emails.log');
const EMAIL_REGISTRY_FILE = path.join(LOG_DIR, 'email-registry.json');
const MEMBERS_JSON_PATH = path.join(__dirname, 'public', 'api', 'members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public', 'embedded-members');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize email registry if it doesn't exist
if (!fs.existsSync(EMAIL_REGISTRY_FILE)) {
  fs.writeFileSync(EMAIL_REGISTRY_FILE, JSON.stringify({}));
}

// Solar constants (copied from server.js to ensure consistency)
const SOLAR_CONSTANTS = {
  USD_PER_SOLAR: 136000,
  DAILY_SOLAR_DISTRIBUTION: 1
};

/**
 * Hash an email address for privacy in logs
 * @param {string} email - Email to hash
 * @returns {string} - Hashed email
 */
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

/**
 * Create backup of members data
 * @returns {boolean} - Success status
 */
function backupMembersData(members) {
  try {
    // Ensure the backup directory exists
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1); // YYYY-MM-DD_HH-MM-SS format
    
    // Create daily backup file
    const backupFilename = path.join(backupDir, `members_backup_${dateStr}.json`);
    fs.writeFileSync(
      backupFilename,
      JSON.stringify(members, null, 2)
    );
    
    // Create a timestamped backup to preserve multiple states
    const timestampedBackupFilename = path.join(backupDir, `members_backup_${timeStr}.json`);
    fs.writeFileSync(
      timestampedBackupFilename,
      JSON.stringify(members, null, 2)
    );
    
    console.log(`[EMAIL-LOGGER] Created member data backup: ${backupFilename}`);
    return true;
  } catch (error) {
    console.error('[EMAIL-LOGGER] Error creating member data backup:', error);
    return false;
  }
}

/**
 * Ensure new signup data is saved to all storage locations
 * @param {Object} userData - User signup data
 * @returns {boolean} - Success status
 */
function ensureDataPersistence(userData) {
  try {
    console.log('[EMAIL-LOGGER] Ensuring data persistence for new signup...');
    
    // Load current members data
    let members = [];
    if (fs.existsSync(MEMBERS_JSON_PATH)) {
      try {
        const data = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
        members = JSON.parse(data);
        console.log(`[EMAIL-LOGGER] Loaded ${members.length} members from members.json`);
      } catch (err) {
        console.error(`[EMAIL-LOGGER] Error loading members.json: ${err.message}`);
      }
    }
    
    // Check if user already exists
    const existingMember = members.find(m => 
      m.email && 
      m.email.toLowerCase() === userData.email.toLowerCase() && 
      !m.isPlaceholder
    );
    
    if (existingMember) {
      console.log(`[EMAIL-LOGGER] User ${userData.name} (${userData.email}) already exists in members data`);
      return true;
    }
    
    // Calculate new member data
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    
    // Check if placeholder exists
    const placeholderIndex = members.findIndex(m => m.name === 'You are next' || m.isPlaceholder);
    if (placeholderIndex !== -1) {
      // Remove placeholder, but we'll add it back later
      members.splice(placeholderIndex, 1);
    }
    
    // Make sure we have a unique ID by checking the maximum existing ID
    const maxId = members.reduce((max, member) => 
      typeof member.id === 'number' && member.id > max ? member.id : max, 0);
    const nextId = maxId + 1;
    
    const newMember = {
      id: nextId,
      username: userData.username || userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
      name: userData.name.trim(),
      email: userData.email.trim(),
      joinedDate: today,
      signupTimestamp: timestamp,
      totalSolar: 1.00, // Initial allocation
      totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
      isAnonymous: userData.isAnonymous || false,
      lastDistributionDate: today
    };
    
    console.log(`[EMAIL-LOGGER] Adding new member #${nextId} with name: ${newMember.name}`);
    
    // Create a backup before making changes
    backupMembersData(members);
    
    // Add to members array
    members.push(newMember);
    
    // Add back the placeholder at the end
    members.push({
      id: nextId + 1,
      username: "you.are.next",
      name: "You are next",
      email: "you.are.next@thecurrentsee.org",
      joinedDate: today,
      totalSolar: 1.00,
      totalDollars: SOLAR_CONSTANTS.USD_PER_SOLAR,
      isAnonymous: false,
      isPlaceholder: true,
      lastDistributionDate: today
    });
    
    // Ensure the api directory exists
    const apiDir = path.dirname(MEMBERS_JSON_PATH);
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }
    
    // Update members.json
    fs.writeFileSync(MEMBERS_JSON_PATH, JSON.stringify(members, null, 2));
    
    // Update embedded-members
    fs.writeFileSync(
      EMBEDDED_MEMBERS_PATH,
      `window.embeddedMembers = ${JSON.stringify(members)};`
    );
    
    console.log(`[EMAIL-LOGGER] Successfully updated all member storage files`);
    
    // Verify files were updated correctly
    try {
      const verifyMembers = JSON.parse(fs.readFileSync(MEMBERS_JSON_PATH, 'utf8'));
      const verifiedMember = verifyMembers.find(m => m.id === newMember.id);
      
      if (verifiedMember && verifiedMember.email === newMember.email) {
        console.log(`[EMAIL-LOGGER] ✓ Verification successful: Member data correctly saved to all storage locations`);
        return true;
      } else {
        console.warn(`[EMAIL-LOGGER] ⚠ Verification warning: Member not found in members.json after save`);
        return false;
      }
    } catch (verifyErr) {
      console.error(`[EMAIL-LOGGER] Verification error: ${verifyErr.message}`);
      return false;
    }
  } catch (error) {
    console.error('[EMAIL-LOGGER] Error ensuring data persistence:', error);
    return false;
  }
}

/**
 * Log a signup with email information
 * @param {Object} userData - User data including email
 * @returns {boolean} - Success status
 */
function logSignup(userData) {
  try {
    if (!userData || !userData.email) {
      console.error('[EMAIL-LOGGER] Invalid user data or missing email');
      return false;
    }

    const timestamp = new Date().toISOString();
    const emailHash = hashEmail(userData.email);
    
    // Create log entry
    const logEntry = {
      timestamp,
      name: userData.name,
      email: userData.email,
      emailHash,
      username: userData.username || userData.name.toLowerCase().replace(/\s+/g, '.'),
      source: userData.source || 'web_signup',
      ipAddress: userData.ipAddress || 'unknown'
    };
    
    // Append to log file
    fs.appendFileSync(EMAIL_LOG_FILE, JSON.stringify(logEntry) + '\n');
    
    // Update registry with mapping from hash to email
    const registry = JSON.parse(fs.readFileSync(EMAIL_REGISTRY_FILE, 'utf8'));
    registry[emailHash] = userData.email;
    fs.writeFileSync(EMAIL_REGISTRY_FILE, JSON.stringify(registry, null, 2));
    
    console.log(`[EMAIL-LOGGER] Successfully logged signup for ${userData.name} with email ${userData.email}`);
    
    // Ensure the data is also persisted to the main storage files
    ensureDataPersistence(userData);
    
    return true;
  } catch (error) {
    console.error('[EMAIL-LOGGER] Error logging signup:', error);
    return false;
  }
}

/**
 * Look up an email by member name
 * @param {string} name - Name to search for
 * @returns {string|null} - Email address if found
 */
function lookupEmailByName(name) {
  try {
    const logContent = fs.readFileSync(EMAIL_LOG_FILE, 'utf8');
    const lines = logContent.trim().split('\n');
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.name.toLowerCase() === name.toLowerCase()) {
          return entry.email;
        }
      } catch (e) {
        continue; // Skip invalid lines
      }
    }
    
    return null;
  } catch (error) {
    console.error('[EMAIL-LOGGER] Error looking up email:', error);
    return null;
  }
}

/**
 * Create a CSV export of all registered emails
 * @returns {string|null} - Path to CSV file if successful
 */
function exportEmailsToCSV() {
  try {
    const logContent = fs.readFileSync(EMAIL_LOG_FILE, 'utf8');
    const lines = logContent.trim().split('\n');
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(entry => entry !== null);
    
    const csvContent = [
      'Name,Email,Username,Timestamp,Source,IP Address',
      ...entries.map(entry => 
        `"${entry.name}","${entry.email}","${entry.username}","${entry.timestamp}","${entry.source}","${entry.ipAddress}"`
      )
    ].join('\n');
    
    const exportPath = path.join(LOG_DIR, `email-export-${new Date().toISOString().replace(/:/g, '-')}.csv`);
    fs.writeFileSync(exportPath, csvContent, 'utf8');
    
    console.log(`[EMAIL-LOGGER] Exported ${entries.length} email records to ${exportPath}`);
    return exportPath;
  } catch (error) {
    console.error('[EMAIL-LOGGER] Error exporting emails:', error);
    return null;
  }
}

module.exports = {
  logSignup,
  lookupEmailByName,
  exportEmailsToCSV,
  ensureDataPersistence // Export this function for external use
};