/**
 * Database Setup Script
 * 
 * This script will:
 * 1. Create the database tables if they don't exist
 * 2. Migrate existing member data from files to the database
 * 3. Create backup records for tracking
 */

// Import the database and storage modules
const fs = require('fs');
const path = require('path');
const { pool, initializeSchema } = require('./db');
const { storage } = require('./storage');

console.log('Starting database setup...');

// Function to run SQL for table creation
async function createTables() {
  try {
    console.log('Creating database tables...');
    
    // Create members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        joined_date TEXT NOT NULL,
        total_solar DECIMAL(20,4) NOT NULL DEFAULT 1,
        total_dollars DECIMAL(20,2) NOT NULL,
        is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        is_reserve BOOLEAN NOT NULL DEFAULT FALSE, 
        is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
        last_distribution_date TEXT NOT NULL,
        notes TEXT,
        signup_timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create distribution_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS distribution_logs (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL,
        distribution_date TEXT NOT NULL,
        solar_amount DECIMAL(20,4) NOT NULL,
        dollar_value DECIMAL(20,2) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create backup_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id SERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        member_count INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Database tables created successfully');
    return true;
  } catch (error) {
    console.error('Error creating database tables:', error);
    return false;
  }
}

// Function to load members from files
async function loadMembersFromFiles() {
  console.log('Loading member data from files...');
  
  const MEMBERS_JSON_PATH = path.join(__dirname, 'public/api/members.json');
  const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');
  const BACKUP_DIR = path.join(__dirname, 'backup');
  
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
  
  return { members: membersData, source: loadedFrom };
}

// Function to migrate members to database
async function migrateMembers(members) {
  console.log(`Migrating ${members.length} members to database...`);
  
  const migratedCount = 0;
  const errors = [];
  
  try {
    // Check if there are already members in the database
    const { rows } = await pool.query('SELECT COUNT(*) FROM members');
    if (rows[0].count > 0) {
      console.log(`Database already contains ${rows[0].count} members`);
      const userInput = await new Promise(resolve => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        readline.question('Database is not empty. Do you want to continue? This may create duplicate entries. (y/n): ', answer => {
          readline.close();
          resolve(answer);
        });
      });
      
      if (userInput.toLowerCase() !== 'y') {
        console.log('Migration aborted by user.');
        return { success: false, migrated: 0, errors: [] };
      }
    }
    
    // Begin transaction
    await pool.query('BEGIN');
    
    for (const memberData of members) {
      // Skip placeholders
      if (memberData.isPlaceholder) {
        continue;
      }
      
      try {
        // Check if member already exists (by username)
        const { rows: existingMembers } = await pool.query(
          'SELECT id FROM members WHERE username = $1',
          [memberData.username]
        );
        
        if (existingMembers.length === 0) {
          // Create new member
          await pool.query(`
            INSERT INTO members (
              username, name, email, joined_date, total_solar, total_dollars,
              is_anonymous, is_reserve, last_distribution_date, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            memberData.username,
            memberData.name,
            memberData.email || `${memberData.username}@example.com`, // Preserve original emails or use a clearly marked placeholder
            memberData.joinedDate,
            memberData.totalSolar.toString(),
            memberData.totalDollars.toString(),
            memberData.isAnonymous || false,
            memberData.isReserve || false,
            memberData.lastDistributionDate,
            memberData.notes || null
          ]);
          migratedCount++;
        } else {
          // Update existing member
          await pool.query(`
            UPDATE members SET 
              name = $1, email = $2, joined_date = $3, total_solar = $4,
              total_dollars = $5, is_anonymous = $6, is_reserve = $7, 
              last_distribution_date = $8, notes = $9
            WHERE username = $10
          `, [
            memberData.name,
            memberData.email || `${memberData.username}@example.com`, // Preserve original emails or use a clearly marked placeholder
            memberData.joinedDate,
            memberData.totalSolar.toString(),
            memberData.totalDollars.toString(),
            memberData.isAnonymous || false,
            memberData.isReserve || false,
            memberData.lastDistributionDate,
            memberData.notes || null,
            memberData.username
          ]);
          migratedCount++;
        }
      } catch (memberError) {
        errors.push({
          member: memberData.username,
          error: memberError.message
        });
      }
    }
    
    // If no errors, commit the transaction
    if (errors.length === 0) {
      await pool.query('COMMIT');
    } else {
      await pool.query('ROLLBACK');
    }
    
    return {
      success: errors.length === 0,
      migrated: migratedCount,
      errors
    };
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    return {
      success: false,
      migrated: migratedCount,
      errors: [...errors, error]
    };
  }
}

// Main function
async function main() {
  try {
    // Initialize the database schema
    console.log('Initializing database schema...');
    const schemaResult = await initializeSchema();
    
    if (!schemaResult.success) {
      console.error('Failed to create database tables:', schemaResult.message);
      process.exit(1);
    }
    
    console.log(schemaResult.message);
    
    // Load members from files
    const { members, source } = await loadMembersFromFiles();
    
    if (members.length === 0) {
      console.error('Could not load any member data from files. Exiting...');
      process.exit(1);
    }
    
    // Check if database already has members
    const { rows } = await pool.query('SELECT COUNT(*) FROM members');
    
    if (parseInt(rows[0].count) > 0) {
      console.log(`Database already contains ${rows[0].count} members`);
      const userInput = await new Promise(resolve => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        readline.question('Database is not empty. Do you want to continue? This may create duplicate entries. (y/n): ', answer => {
          readline.close();
          resolve(answer);
        });
      });
      
      if (userInput.toLowerCase() !== 'y') {
        console.log('Migration aborted by user.');
        process.exit(0);
      }
    }
    
    // Migrate members to database using the storage module
    console.log(`Migrating ${members.length} members to database...`);
    const migrationResult = await storage.migrateFileBasedMembersToDatabase(members);
    
    if (migrationResult.success) {
      console.log(`✅ Successfully migrated ${migrationResult.imported} members to database.`);
      
      // Log the backup using storage
      await storage.createBackupLog({
        backupType: 'migration',
        filename: source,
        memberCount: migrationResult.imported
      });
    } else {
      console.log(`⚠️ Partially migrated ${migrationResult.imported} members to database with ${migrationResult.errors.length} errors.`);
      for (const error of migrationResult.errors) {
        if (error.member) {
          console.error(`- Error with member ${error.member}: ${error.error}`);
        } else {
          console.error(`- Error: ${error}`);
        }
      }
    }
    
    // Export current state to a verification file using storage
    const exportPath = path.join(__dirname, 'backup', `migration_export_${new Date().toISOString().replace(/:/g, '-')}.json`);
    const exportResult = await storage.exportMembersToJson(exportPath);
    
    if (exportResult.success) {
      console.log(`Exported migrated data to ${exportPath} (${exportResult.exported} members)`);
    } else {
      console.error('Failed to export verification data.');
    }
    
    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Error during database setup:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});