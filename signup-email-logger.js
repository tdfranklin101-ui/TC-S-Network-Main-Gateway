/**
 * Signup Email Logger
 * 
 * This module creates a dedicated system to log and preserve all signup information,
 * especially email addresses, to ensure they're never lost during migrations or updates.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurable paths
const LOG_DIR = path.join(__dirname, 'logs');
const EMAIL_LOG_FILE = path.join(LOG_DIR, 'signup-emails.log');
const EMAIL_REGISTRY_FILE = path.join(LOG_DIR, 'email-registry.json');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize email registry if it doesn't exist
if (!fs.existsSync(EMAIL_REGISTRY_FILE)) {
  fs.writeFileSync(EMAIL_REGISTRY_FILE, JSON.stringify({}));
}

/**
 * Hash an email address for privacy in logs
 * @param {string} email - Email to hash
 * @returns {string} - Hashed email
 */
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
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
  exportEmailsToCSV
};