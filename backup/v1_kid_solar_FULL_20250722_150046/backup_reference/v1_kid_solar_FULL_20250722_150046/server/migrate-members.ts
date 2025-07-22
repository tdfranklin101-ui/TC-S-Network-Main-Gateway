import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { members, distributionLogs, backupLogs } from '../shared/schema';

// Path to members files
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MEMBERS_JSON_PATH = path.join(PUBLIC_DIR, 'api', 'members.json');
const EMBEDDED_MEMBERS_PATH = path.join(PUBLIC_DIR, 'embedded-members');
const BACKUP_DIR = path.join(process.cwd(), 'backup');

async function migrateMembers() {
  console.log('Starting migration of member data to database...');
  
  // Check if database tables exist
  try {
    await db.query.members.findFirst();
    console.log('Database tables are ready');
  } catch (error) {
    console.error('Error accessing database tables:', error.message);
    console.log('Please run "npm run db:push" to create the database tables first');
    return;
  }
  
  let membersData = [];
  let loadedFrom = 'unknown';
  
  // Try loading from members.json first
  if (fs.existsSync(MEMBERS_JSON_PATH)) {
    try {
      const data = fs.readFileSync(MEMBERS_JSON_PATH, 'utf8');
      membersData = JSON.parse(data);
      loadedFrom = 'members.json';
      console.log(`Loaded ${membersData.length} members from members.json`);
    } catch (err) {
      console.error(`Error loading from members.json:`, err);
    }
  }
  
  // If no data from members.json, try embedded-members
  if (membersData.length === 0 && fs.existsSync(EMBEDDED_MEMBERS_PATH)) {
    try {
      const data = fs.readFileSync(EMBEDDED_MEMBERS_PATH, 'utf8');
      const match = data.match(/window\.embeddedMembers\s*=\s*(\[.*\]);/s);
      if (match && match[1]) {
        membersData = JSON.parse(match[1]);
        loadedFrom = 'embedded-members';
        console.log(`Loaded ${membersData.length} members from embedded-members`);
      }
    } catch (err) {
      console.error(`Error loading from embedded-members:`, err);
    }
  }
  
  // If still no data, try backups
  if (membersData.length === 0 && fs.existsSync(BACKUP_DIR)) {
    try {
      const backupFiles = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.includes('members_backup') && file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Newest first
      
      for (const backupFile of backupFiles) {
        const backupPath = path.join(BACKUP_DIR, backupFile);
        try {
          const data = fs.readFileSync(backupPath, 'utf8');
          const parsedData = JSON.parse(data);
          if (parsedData && parsedData.length > 0) {
            membersData = parsedData;
            loadedFrom = `backup (${backupFile})`;
            console.log(`Loaded ${membersData.length} members from backup: ${backupFile}`);
            break;
          }
        } catch (err) {
          console.error(`Error loading from backup ${backupFile}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error accessing backup directory:`, err);
    }
  }
  
  if (membersData.length === 0) {
    console.error('Could not load any member data from files. Migration aborted.');
    return;
  }
  
  // Check if database is empty first
  const existingMembersCount = await db.select({ count: { value: db.count() } }).from(members);
  if (existingMembersCount[0].count.value > 0) {
    console.log(`Database already contains ${existingMembersCount[0].count.value} members.`);
    const userInput = await promptUser('Database is not empty. Do you want to continue? This may create duplicate entries. (y/n): ');
    if (userInput.toLowerCase() !== 'y') {
      console.log('Migration aborted by user.');
      return;
    }
  }
  
  // Migrate members to database
  try {
    console.log(`Migrating ${membersData.length} members from ${loadedFrom} to database...`);
    const result = await storage.migrateFileBasedMembersToDatabase(membersData);
    
    if (result.success) {
      console.log(`✅ Successfully migrated ${result.migrated} members to database.`);
    } else {
      console.log(`⚠️ Partially migrated ${result.migrated} members to database with ${result.errors.length} errors.`);
      for (const error of result.errors) {
        console.error(`- Error with member ${error.member}: ${error.error}`);
      }
    }
    
    // Create a backup log
    await storage.createBackupLog({
      backupType: 'migration',
      filename: loadedFrom,
      memberCount: result.migrated
    });
    
    // Export the migrated data as verification
    const exportPath = path.join(BACKUP_DIR, `migration_export_${new Date().toISOString().replace(/:/g, '-')}.json`);
    const exportResult = await storage.exportMembersToJson(exportPath);
    console.log(`Exported migrated data to ${exportPath} (${exportResult.exported} members)`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Simple function to prompt for user input
function promptUser(question: string): Promise<string> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateMembers().catch(console.error).finally(() => process.exit(0));
}

export { migrateMembers };