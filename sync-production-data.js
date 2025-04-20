/**
 * Production Data Synchronization Tool
 * 
 * This script fetches the latest member data from the production site
 * and synchronizes it with the development environment to ensure
 * consistent data before deployment.
 * 
 * Usage: node sync-production-data.js
 */

const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

// Configuration
const PRODUCTION_URL = 'https://www.thecurrentsee.org';
const LOCAL_MEMBERS_PATH = path.join(__dirname, 'public', 'api', 'members.json');
const LOCAL_EMBEDDED_PATH = path.join(__dirname, 'public', 'embedded-members');
const BACKUP_DIR = path.join(__dirname, 'backup');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Helper function to format date for backups
function getFormattedDate() {
  const now = new Date();
  return {
    dateOnly: now.toISOString().split('T')[0],
    dateTime: now.toISOString().replace(/:/g, '-').replace(/\..+/, '')
  };
}

// Create backups of current files
function createBackups() {
  const { dateOnly, dateTime } = getFormattedDate();
  
  console.log('Creating backups of current data...');
  
  // Backup members.json
  if (fs.existsSync(LOCAL_MEMBERS_PATH)) {
    const membersData = fs.readFileSync(LOCAL_MEMBERS_PATH, 'utf8');
    fs.writeFileSync(path.join(BACKUP_DIR, `members_backup_pre_sync_${dateTime}.json`), membersData);
  }
  
  // Backup embedded-members
  if (fs.existsSync(LOCAL_EMBEDDED_PATH)) {
    const embeddedData = fs.readFileSync(LOCAL_EMBEDDED_PATH, 'utf8');
    fs.writeFileSync(path.join(BACKUP_DIR, `embedded_backup_pre_sync_${dateTime}`), embeddedData);
  }
  
  console.log('Backups created successfully.');
}

// Fetch production data and update local files
async function syncProductionData() {
  try {
    console.log(`Fetching latest member data from ${PRODUCTION_URL}...`);
    
    // Fetch production members.json
    const membersResponse = await fetch(`${PRODUCTION_URL}/api/members.json`);
    if (!membersResponse.ok) {
      throw new Error(`Failed to fetch members data: ${membersResponse.statusText}`);
    }
    const membersData = await membersResponse.json();
    
    // Update local members.json
    fs.writeFileSync(LOCAL_MEMBERS_PATH, JSON.stringify(membersData, null, 2));
    console.log('Updated local members.json with production data.');
    
    // Create embedded-members format
    const embeddedData = `window.embeddedMembers = ${JSON.stringify(membersData)
      .replace(/"totalSolar":(\d+)/g, '"totalSolar":"$1.0000"')};`;
    
    // Update local embedded-members
    fs.writeFileSync(LOCAL_EMBEDDED_PATH, embeddedData);
    console.log('Updated local embedded-members with production data.');
    
    // Create a daily backup with the synced data
    const { dateOnly } = getFormattedDate();
    fs.writeFileSync(path.join(BACKUP_DIR, `members_backup_${dateOnly}.json`), JSON.stringify(membersData, null, 2));
    
    console.log('Synchronization completed successfully!');
    
  } catch (error) {
    console.error('Synchronization failed:', error.message);
    process.exit(1);
  }
}

// Main execution
(async function main() {
  console.log('Starting production data synchronization...');
  createBackups();
  await syncProductionData();
  console.log('✅ Production data sync complete. You can now proceed with deployment.');
})();