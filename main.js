/**
 * Simple Production Server for The Current-See
 * 
 * A minimal server implementation for deploying the website
 * that handles both serving static files and health checks.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

// Create express app
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INCLUDES_DIR = path.join(PUBLIC_DIR, 'includes');

// Solar constants for calculations
const SOLAR_CONSTANTS = {
  KWPH_PER_METER_SQUARED: 1.366, // kW per hour per square meter
  EARTH_SURFACE_KM2: 510100000, // Earth's surface area in square km
  LAND_SURFACE_KM2: 149000000, // Land surface area in square km
  COLLECTION_EFFICIENCY: 0.20, // 20% collection efficiency
  METERS_PER_KM2: 1000000, // Square meters per square km
  GLOBAL_POPULATION: 8500000000, // Approximate global population
  SOLAR_PERCENT: 0.01, // 1% allocation for humanity
  USD_PER_SOLAR: 136000, // Current-See conversion rate ($136,000 per SOLAR)
  KWH_PER_SOLAR: 4913, // kWh per SOLAR
  GENERATION_START_DATE: new Date('2025-04-07T00:00:00Z') // Solar tracking start date
};

// Solar calculation utils (these will be needed for the counter and value calculations)
function calculateTotalEnergy() {
  const now = new Date();
  const elapsedSeconds = (now - SOLAR_CONSTANTS.GENERATION_START_DATE) / 1000;
  const elapsedHours = elapsedSeconds / 3600;
  
  const totalPowerPerHour = SOLAR_CONSTANTS.KWPH_PER_METER_SQUARED * 
                           SOLAR_CONSTANTS.EARTH_SURFACE_KM2 * 
                           SOLAR_CONSTANTS.METERS_PER_KM2 * 
                           SOLAR_CONSTANTS.COLLECTION_EFFICIENCY;
  
  // Total energy in kWh
  const totalEnergyKwh = totalPowerPerHour * elapsedHours * SOLAR_CONSTANTS.SOLAR_PERCENT;
  
  // Convert to million kWh (MkWh) for display
  const totalEnergyMkwh = totalEnergyKwh / 1000000;
  
  return totalEnergyMkwh;
}

function calculateTotalValue() {
  const totalEnergy = calculateTotalEnergy() * 1000000; // Convert back to kWh
  const kwhPerSolar = (SOLAR_CONSTANTS.KWPH_PER_METER_SQUARED * 
                       SOLAR_CONSTANTS.EARTH_SURFACE_KM2 * 
                       SOLAR_CONSTANTS.METERS_PER_KM2 * 
                       SOLAR_CONSTANTS.COLLECTION_EFFICIENCY * 
                       SOLAR_CONSTANTS.SOLAR_PERCENT) / 
                       SOLAR_CONSTANTS.GLOBAL_POPULATION * 24; // kWh per person per day
  
  // Calculate total SOLAR tokens based on energy generated
  const totalSolar = totalEnergy / kwhPerSolar;
  
  // Calculate value in USD
  return totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR;
}

// Members data array (loaded from file)
let members = [];

// Helper function to load members from a specific file path
function loadMembersFromFile(filePath, backupType = 'primary') {
  try {
    if (fs.existsSync(filePath)) {
      const loadedData = fs.readFileSync(filePath, 'utf8');
      const loadedMembers = JSON.parse(loadedData);
      log(`Loaded ${loadedMembers.length} members from ${backupType} file at ${filePath}`);
      return loadedMembers;
    }
  } catch (error) {
    log(`Error loading ${backupType} members file from ${filePath}: ${error.message}`);
  }
  return null;
}

// Helper function to extract members from the embedded-members JavaScript file
function extractMembersFromEmbeddedFile(embeddedPath) {
  try {
    if (fs.existsSync(embeddedPath)) {
      const embeddedContent = fs.readFileSync(embeddedPath, 'utf8');
      // Extract the JSON array from the JavaScript assignment
      const match = embeddedContent.match(/window\.embeddedMembers\s*=\s*(\[.*\]);/s);
      if (match && match[1]) {
        const embeddedMembers = JSON.parse(match[1]);
        log(`Extracted ${embeddedMembers.length} members from embedded-members file`);
        return embeddedMembers;
      }
    }
  } catch (error) {
    log(`Error extracting members from embedded-members file: ${error.message}`);
  }
  return null;
}

// Initialize function to load members data with multiple fallback mechanisms
function loadMembers() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const membersFilePath = path.join(PUBLIC_DIR, 'api', 'members.json');
    const embeddedMembersPath = path.join(PUBLIC_DIR, 'embedded-members');
    const backupDir = path.join(__dirname, 'backup');
    
    // First try the primary members.json file
    let loadedMembers = loadMembersFromFile(membersFilePath);
    
    // If primary file failed or has fewer than expected members, try embedded-members
    if (!loadedMembers || loadedMembers.length < 13) { // We should have at least 13 members including reserve and others
      log('Primary members file missing or incomplete, attempting to load from embedded-members');
      const embeddedMembers = extractMembersFromEmbeddedFile(embeddedMembersPath);
      
      if (embeddedMembers && (!loadedMembers || embeddedMembers.length > loadedMembers.length)) {
        loadedMembers = embeddedMembers;
        log(`Using ${embeddedMembers.length} members from embedded-members file as it has more records`);
      }
    }
    
    // If still not found, try backup files
    if (!loadedMembers || loadedMembers.length < 13) {
      log('Still missing members, trying backup files');
      
      // Try to find all backup files
      if (fs.existsSync(backupDir)) {
        const backupFiles = fs.readdirSync(backupDir)
          .filter(file => file.includes('members_backup') && file.endsWith('.json'))
          .sort((a, b) => b.localeCompare(a)) // Sort in reverse alphabetical order to get newest first
          .map(file => path.join(backupDir, file));
        
        for (const backupPath of backupFiles) {
          const backupMembers = loadMembersFromFile(backupPath, 'backup');
          if (backupMembers && (!loadedMembers || backupMembers.length > loadedMembers.length)) {
            loadedMembers = backupMembers;
            log(`Using ${backupMembers.length} members from backup file ${backupPath} as it has more records`);
            break;
          }
        }
      }
    }
    
    // Use the loaded members if successful
    if (loadedMembers && loadedMembers.length > 0) {
      members = loadedMembers;
      log(`Successfully loaded ${members.length} members`);
      
      // Check if we're missing specific known members
      log(`Running essential member verification for ${members.length} loaded members...`);
      
      const knownMembers = {
        'brianna': { name: 'Brianna', email: 'brianna@example.com', joinedDate: '2025-04-20', totalSolar: 3 },
        'kealani.ventura': { name: 'Kealani Ventura', email: 'kealani@example.com', joinedDate: '2025-04-21', totalSolar: 2 },
        'alex': { name: 'Alex', email: 'alex@example.com', joinedDate: '2025-04-21', totalSolar: 2 }
      };
      
      // Enhanced logging for the validation process
      log(`Verifying presence of ${Object.keys(knownMembers).length} essential members: ${Object.keys(knownMembers).join(', ')}`);
      
      // Track members who need recovery
      const membersToRecover = [];
      
      // Check for each known member with enhanced validation
      for (const [username, data] of Object.entries(knownMembers)) {
        // Define multiple ways to match a member
        const nameLower = data.name.toLowerCase();
        const usernameLower = username.toLowerCase();
        const emailLower = data.email ? data.email.toLowerCase() : null;
        
        // Log the check we're performing
        log(`Checking for member: username="${username}", name="${data.name}", email=${data.email ? `"${data.email}"` : 'null'}`);
        
        // Perform more comprehensive checks with better logging
        const memberExists = members.some(m => {
          // Check username (exact and lowercase)
          const usernameMatch = m.username === username || 
                               (m.username && m.username.toLowerCase() === usernameLower);
          
          // Check name (exact and lowercase)
          const nameMatch = m.name === data.name || 
                           (m.name && m.name.toLowerCase() === nameLower);
          
          // Check email (if both exist, compare lowercase)
          const emailMatch = (m.email && emailLower && 
                             m.email.toLowerCase() === emailLower);
          
          return usernameMatch || nameMatch || emailMatch;
        });
        
        if (!memberExists) {
          log(`RECOVERY NEEDED: Essential member "${data.name}" (${username}) is missing`);
          membersToRecover.push([username, data]);
        } else {
          log(`Verified: ${data.name} exists in member list`);
        }
      }
      
      // Now recover any missing members
      if (membersToRecover.length > 0) {
        log(`Recovering ${membersToRecover.length} missing essential members...`);
        
        for (const [username, data] of membersToRecover) {
          // Calculate next ID - but we'll renumber them all later for consistency
          const maxId = Math.max(...members.map(m => m.id));
          const newId = maxId + 1;
          
          // Add the missing member
          const missingMember = {
            id: newId, // Temporary ID
            username: username,
            name: data.name,
            email: data.email,
            joinedDate: data.joinedDate,
            totalSolar: data.totalSolar,
            totalDollars: Math.round(data.totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR),
            isAnonymous: false,
            lastDistributionDate: new Date().toISOString().split('T')[0] // Today
          };
          
          members.push(missingMember);
          log(`RESTORED MEMBER: "${data.name}" (temporarily with ID ${newId}) and ${data.totalSolar} SOLAR`);
        }
        
        // Renumber all member IDs for consistency (preserve TC-S Reserve at 0)
        log(`Renumbering ${members.length} member IDs for consistency`);
        
        // First, find the "you are next" entry and remove it temporarily if it exists
        let placeholderIndex = members.findIndex(m => 
          m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
        let placeholder = null;
        
        if (placeholderIndex !== -1) {
          placeholder = members.splice(placeholderIndex, 1)[0];
          log(`Temporarily removed "You are next" placeholder for renumbering`);
        }
        
        // Also identify any reserve entries that should stay at the beginning
        const reserveEntries = members.filter(m => m.isReserve === true);
        
        // Remove reserves from the main array
        members = members.filter(m => m.isReserve !== true);
        
        // Sort non-reserve members by join date
        members.sort((a, b) => {
          // Convert strings to dates for proper comparison
          const dateA = new Date(a.joinedDate);
          const dateB = new Date(b.joinedDate);
          return dateA - dateB;
        });
        
        // Add reserves back at the beginning
        members = [...reserveEntries, ...members];
        
        // Renumber all members
        members.forEach((member, index) => {
          member.id = index;
        });
        
        // Add placeholder back at the end if it existed
        if (placeholder) {
          placeholder.id = members.length;
          members.push(placeholder);
          log(`Added "You are next" placeholder back at the end with ID ${placeholder.id}`);
        }
        
        // Save the updated members list immediately after recovery
        updateMembersFiles();
        log(`Saved members list with ${members.length} total members after recovery and ID renumbering`);
      } else {
        log(`All essential members verified successfully. No recovery needed.`);
      }
      
      // Verify we have a placeholder and it's the last entry
      let placeholderExists = members.some(m => 
        m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
      
      // Check if placeholder is not the last entry
      const lastMember = members[members.length - 1];
      const placeholderIsLast = lastMember && 
                               lastMember.username === "you.are.next" && 
                               lastMember.name.toLowerCase().includes("you are next");
      
      // If placeholder exists but is not last, reposition it
      if (placeholderExists && !placeholderIsLast) {
        log('Placeholder exists but is not the last entry, repositioning it');
        
        // Find and remove the placeholder
        const placeholderIndex = members.findIndex(m => 
          m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
        
        if (placeholderIndex !== -1) {
          const placeholder = members.splice(placeholderIndex, 1)[0];
          members.push(placeholder);
          log('Moved placeholder to the end of the member list');
        }
      }
      
      // Create a backup of the successfully loaded members
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(backupDir, `members_backup_loaded_${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(members, null, 2));
      log(`Created backup of ${members.length} successfully loaded members at ${backupPath}`);
      
      // Immediately save all current members to ensure persistence in all locations
      updateMembersFiles();
      log('Saved current members to all locations to ensure persistence at initial login');
      
      // Check if there's a TC-S Solar Reserve entry
      const hasReserve = members.some(m => m.username === "tc-s.reserve" && m.name === "TC-S Solar Reserve");
      
      // If no reserve exists, add one
      if (!hasReserve) {
        log('Adding TC-S Solar Reserve to members');
        
        // Insert at the beginning of the array (id 0 to ensure it's first)
        members.unshift({
          id: 0,
          username: "tc-s.reserve",
          name: "TC-S Solar Reserve",
          email: "reserve@thecurrentsee.org",
          joinedDate: "2025-04-07", // Start from the genesis date
          totalSolar: 10000000000.0000, // 10 billion Solar
          totalDollars: 10000000000 * SOLAR_CONSTANTS.USD_PER_SOLAR,
          isAnonymous: false,
          lastDistributionDate: today,
          isReserve: true,
          notes: "Genesis Reserve Allocation"
        });
        
        // Re-number the IDs to ensure consistency
        members.forEach((member, index) => {
          member.id = index;
        });
        
        // Save the updated members list
        updateMembersFiles();
      }
      
      // Check if there's a "You are next" placeholder entry (using variable from above)
      // If no placeholder exists, add one
      if (!placeholderExists) {
        const placeholderId = members.length + 1;
        log(`Adding "You are next" placeholder as member #${placeholderId}`);
        
        members.push({
          id: placeholderId,
          username: "you.are.next",
          name: "You are next",
          joinedDate: today,
          totalSolar: 1.0000,
          totalDollars: Math.round(1.0000 * SOLAR_CONSTANTS.USD_PER_SOLAR),
          isAnonymous: false,
          lastDistributionDate: today
        });
        
        // Save the updated members list
        updateMembersFiles();
      }
    } else {
      // Initialize with default members if file doesn't exist
      members = [
        {
          id: 0,
          username: "tc-s.reserve",
          name: "TC-S Solar Reserve",
          email: "reserve@thecurrentsee.org",
          joinedDate: "2025-04-07", // Start from the genesis date
          totalSolar: 10000000000.0000, // 10 billion Solar
          totalDollars: 10000000000 * SOLAR_CONSTANTS.USD_PER_SOLAR,
          isAnonymous: false,
          lastDistributionDate: today,
          isReserve: true,
          notes: "Genesis Reserve Allocation"
        },
        {
          id: 1,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          totalSolar: 10.0000,
          totalDollars: 1360000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 2,
          username: "j.franklin",
          name: "JF",
          joinedDate: "2025-04-10",
          totalSolar: 9.0000,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 3,
          username: "d.franklin",
          name: "Davis",
          email: "Davisfranklin095@gmail.com",
          joinedDate: "2025-04-18", 
          totalSolar: 2.0000,
          totalDollars: 272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 4,
          username: "m.franklin",
          name: "Miles Franklin",
          email: "Milesgfranklin9@gmail.com",
          joinedDate: "2025-04-18",
          totalSolar: 2.0000,
          totalDollars: 272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 5,
          username: "a.franklin",
          name: "Arden F",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 6,
          username: "m.hasseman",
          name: "Marissa Hasseman",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 7,
          username: "k.member",
          name: "Kim",
          email: "KIMBROWN9999@hotmail.com",
          joinedDate: "2025-04-19",
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-19"
        },
        {
          id: 8,
          username: "you.are.next",
          name: "You are next",
          joinedDate: today,
          totalSolar: 1.0000,
          totalDollars: 136000,
          isAnonymous: false,
          lastDistributionDate: today
        }
      ];
      // Save default members
      updateMembersFiles();
    }
    
    // Also update the embedded-members file for quick loading
    updateEmbeddedMembersFile();
    
    // Finally, check for ID sequential integrity
    ensureMemberIdIntegrity();
  } catch (error) {
    log(`Error loading members: ${error.message}`);
  }
}

// New function to check and fix member ID sequential integrity
function ensureMemberIdIntegrity() {
  try {
    // Check if IDs are sequential and consistent
    const hasIdGaps = members.some((member, index) => {
      return member.id !== index;
    });
    
    // If there are gaps or non-sequential IDs, fix them
    if (hasIdGaps) {
      log(`⚠️ Found non-sequential member IDs, performing automatic correction`);
      
      // First handle "you are next" placeholder
      let placeholder = null;
      const placeholderIndex = members.findIndex(m => 
        m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
      
      if (placeholderIndex !== -1) {
        placeholder = members.splice(placeholderIndex, 1)[0];
        log(`Temporarily removed "You are next" placeholder for ID correction`);
      }
      
      // Handle reserve entries
      const reserveEntries = members.filter(m => m.isReserve === true);
      members = members.filter(m => m.isReserve !== true);
      
      // Sort regular members by join date
      members.sort((a, b) => {
        const dateA = new Date(a.joinedDate || '2025-04-22');
        const dateB = new Date(b.joinedDate || '2025-04-22');
        return dateA - dateB;
      });
      
      // Add reserves back at the beginning
      members = [...reserveEntries, ...members];
      
      // Renumber all members
      members.forEach((member, index) => {
        member.id = index;
      });
      
      // Add placeholder back at the end if it existed
      if (placeholder) {
        placeholder.id = members.length;
        members.push(placeholder);
      }
      
      // Save the corrected member list
      updateMembersFiles();
      log(`✓ Successfully corrected member IDs and saved the updated list`);
    } else {
      log(`✓ Member IDs are sequential and consistent`);
    }
  } catch (error) {
    log(`Error checking member ID integrity: ${error.message}`);
  }
}

// Save members data to all storage locations with backups
function updateMembersFiles() {
  try {
    // First ensure the api directory exists
    const apiDir = path.join(PUBLIC_DIR, 'api');
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
      log(`Created API directory at ${apiDir}`);
    }
    
    const membersFilePath = path.join(apiDir, 'members.json');
    
    // Save to primary file
    fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2));
    log(`Updated primary members file with ${members.length} members`);
    
    // Also update embedded-members
    updateEmbeddedMembersFile();
    
    // Create daily backup
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Date for daily backup
    const today = new Date().toISOString().split('T')[0];
    const dailyBackupPath = path.join(backupDir, `members_backup_${today}.json`);
    
    // Save daily backup
    fs.writeFileSync(dailyBackupPath, JSON.stringify(members, null, 2));
    log(`Updated daily backup at ${dailyBackupPath}`);
    
    // Create timestamped backup
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const timestampedBackupPath = path.join(backupDir, `members_backup_${timestamp}.json`);
    
    // Save timestamped backup
    fs.writeFileSync(timestampedBackupPath, JSON.stringify(members, null, 2));
    log(`Created timestamped backup at ${timestampedBackupPath}`);
    
    // Verify main file was written successfully
    if (fs.existsSync(membersFilePath)) {
      const stats = fs.statSync(membersFilePath);
      log(`Verified primary members file: ${stats.size} bytes written at ${new Date(stats.mtime).toISOString()}`);
    } else {
      log(`Warning: Primary members file not found after write attempt!`);
      // Try emergency write with different method
      try {
        fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2), { flag: 'w' });
        log(`Emergency rewrite of primary members file attempted`);
      } catch (emergencyError) {
        log(`Emergency rewrite failed: ${emergencyError.message}`);
      }
    }
    
    // Cleanup old backups (keep last 20)
    try {
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('members_backup_') && file.endsWith('.json') && !file.includes(today))
        .map(file => path.join(backupDir, file))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());
      
      // Keep only the 20 most recent non-daily backups
      if (backupFiles.length > 20) {
        const filesToDelete = backupFiles.slice(20);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file);
            log(`Deleted old backup: ${file}`);
          } catch (deleteError) {
            log(`Failed to delete old backup ${file}: ${deleteError.message}`);
          }
        });
      }
    } catch (cleanupError) {
      log(`Error during backup cleanup: ${cleanupError.message}`);
    }
  } catch (error) {
    log(`Error updating members files: ${error.message}`);
  }
}

// Update embedded-members file (used for quick loading on client)
function updateEmbeddedMembersFile() {
  try {
    // Format the members data with 4 decimal places for SOLAR values
    const formattedMembers = members.map(member => {
      // Create a copy of the member
      const formattedMember = {...member};
      
      // Format totalSolar to 4 decimal places if it's a number
      if (typeof formattedMember.totalSolar !== 'undefined') {
        formattedMember.totalSolar = parseFloat(formattedMember.totalSolar).toFixed(4);
      }
      
      return formattedMember;
    });
    
    const embeddedMembersPath = path.join(PUBLIC_DIR, 'embedded-members');
    fs.writeFileSync(embeddedMembersPath, 
      `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`);
    log('Updated embedded-members file with 4 decimal place SOLAR values');
  } catch (error) {
    log(`Error updating embedded-members file: ${error.message}`);
  }
}

// Process daily distribution for all members
function processDailyDistribution() {
  const today = new Date().toISOString().split('T')[0];
  let updatedCount = 0;
  
  members.forEach(member => {
    if (member.lastDistributionDate !== today) {
      // Add daily distribution (1 SOLAR per day)
      member.totalSolar += 1;
      // Format with 4 decimal places (1.0000 format)
      member.totalSolar = parseFloat(member.totalSolar.toFixed(4));
      // Calculate dollar value (rounding to whole numbers as requested)
      member.totalDollars = Math.round(member.totalSolar * SOLAR_CONSTANTS.USD_PER_SOLAR);
      member.lastDistributionDate = today;
      updatedCount++;
      log(`Member ${member.name} received 1 SOLAR, new total: ${member.totalSolar.toFixed(4)} SOLAR = $${member.totalDollars.toLocaleString()}`);
    }
  });
  
  if (updatedCount > 0) {
    log(`Processed daily distribution for ${updatedCount} members`);
    updateMembersFiles();
  }
}

// Load members on server start
loadMembers();

// Set up scheduled tasks
const DISTRIBUTION_HOUR_UTC = 0; // Midnight UTC (GMT)
function setupScheduledTasks() {
  // Check if we need to process distributions on startup
  checkAndProcessDailyDistributions();
  
  // Schedule daily check at midnight UTC
  setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === DISTRIBUTION_HOUR_UTC && now.getUTCMinutes() === 0) {
      log('Scheduled distribution time reached, processing...');
      processDailyDistribution();
    }
  }, 60 * 1000); // Check every minute
  
  log('Scheduled tasks initialized');
}

// Check and run daily distributions if needed
function checkAndProcessDailyDistributions() {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if any member needs distribution for today
  const needsDistribution = members.some(m => m.lastDistributionDate !== today);
  
  if (needsDistribution) {
    log('Found members needing distribution for today, processing...');
    processDailyDistribution();
  } else {
    log('All members are up to date with distributions');
  }
}

// Start scheduled tasks
setupScheduledTasks();

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging function
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Create a function to handle graceful shutdown
function gracefulShutdown() {
  log('SIGTERM or SIGINT received, initiating graceful shutdown...');
  
  // Create an emergency backup before shutdown
  try {
    log('Creating emergency pre-shutdown backup...');
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const emergencyBackupPath = path.join(backupDir, `members_backup_pre_shutdown_${timestamp}.json`);
    
    // Write the backup with retries
    let backupSuccess = false;
    for (let i = 0; i < 3; i++) {
      try {
        fs.writeFileSync(emergencyBackupPath, JSON.stringify(members, null, 2), { flag: 'w' });
        const stats = fs.statSync(emergencyBackupPath);
        log(`Successfully created emergency pre-shutdown backup: ${stats.size} bytes written at ${new Date(stats.mtime).toISOString()}`);
        backupSuccess = true;
        break;
      } catch (backupError) {
        log(`Attempt ${i+1} to create emergency backup failed: ${backupError.message}`);
      }
    }
    
    if (!backupSuccess) {
      log('WARNING: Failed to create emergency backup before shutdown');
    }
    
    // Also update the standard API file and embedded-members as a last resort
    try {
      const membersFilePath = path.join(PUBLIC_DIR, 'api', 'members.json');
      fs.writeFileSync(membersFilePath, JSON.stringify(members, null, 2), { flag: 'w' });
      log('Final update of members.json before shutdown');
      
      const embeddedMembersPath = path.join(PUBLIC_DIR, 'embedded-members');
      const formattedMembers = members.map(member => {
        const formattedMember = {...member};
        if (typeof formattedMember.totalSolar !== 'undefined') {
          formattedMember.totalSolar = parseFloat(formattedMember.totalSolar).toFixed(4);
        }
        return formattedMember;
      });
      
      fs.writeFileSync(embeddedMembersPath, 
        `window.embeddedMembers = ${JSON.stringify(formattedMembers)};`, { flag: 'w' });
      log('Final update of embedded-members before shutdown');
    } catch (finalError) {
      log(`Error during final file updates: ${finalError.message}`);
    }
  } catch (error) {
    log(`Error during graceful shutdown: ${error.message}`);
  }
  
  log('Graceful shutdown complete, exiting...');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Health check endpoint - explicit route for monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Redirect paths for removed pages
app.get('/my-solar', (req, res) => {
  log('Redirecting /my-solar request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/login', (req, res) => {
  log('Redirecting /login request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/register', (req, res) => {
  log('Redirecting /register request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

app.get('/wallet', (req, res) => {
  log('Redirecting /wallet request to /wallet-ai-features.html');
  res.redirect('/wallet-ai-features.html');
});

// Root endpoint - special handling for deployment health checks
app.get('/', (req, res, next) => {
  // If it's a health check (no user agent), just return OK
  if (!req.headers['user-agent']) {
    return res.status(200).send('OK');
  }
  
  // For normal users, serve the index.html file with header/footer injected
  try {
    let indexContent = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      indexContent = indexContent.replace('<!-- HEADER_PLACEHOLDER -->', header);
      indexContent = indexContent.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(indexContent);
  } catch (error) {
    log(`Error serving index.html: ${error.message}`);
    next();
  }
});

// Handle HTML files with header/footer injection
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) {
    return next();
  }
  
  try {
    const filePath = path.join(PUBLIC_DIR, req.path);
    
    if (!fs.existsSync(filePath)) {
      return next();
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Try to inject header and footer
    try {
      const header = fs.readFileSync(path.join(INCLUDES_DIR, 'header.html'), 'utf8');
      const footer = fs.readFileSync(path.join(INCLUDES_DIR, 'footer.html'), 'utf8');
      
      content = content.replace('<!-- HEADER_PLACEHOLDER -->', header);
      content = content.replace('<!-- FOOTER_PLACEHOLDER -->', footer);
      
      // Ensure scripts are properly loaded after DOM content
      if (content.includes('/js/real_time_solar_counter.js')) {
        log(`Found solar counter script in ${req.path}, ensuring proper initialization`);
        
        // Make sure trySolarCounterInit is called after page fully loads
        // by adding an additional script before closing body tag
        const additionalScript = `
<script>
  // Ensure solar counter initialization happens after DOM is fully loaded
  window.addEventListener('load', function() {
    console.log('Window fully loaded with injected content, running solar counter init');
    setTimeout(function() {
      if (typeof trySolarCounterInit === 'function') {
        trySolarCounterInit();
      }
    }, 100);
  });
</script>`;
        
        // Add script just before closing body tag
        content = content.replace('</body>', additionalScript + '</body>');
      }
    } catch (includeError) {
      log(`Warning: Could not inject header/footer: ${includeError.message}`);
    }
    
    res.set('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    log(`Error serving ${req.path}: ${error.message}`);
    next();
  }
});

// Sign up endpoint
app.post('/api/signup', (req, res) => {
  try {
    log('Received signup request: ' + JSON.stringify(req.body));
    const userData = req.body;
    
    // Validate required fields
    if (!userData.name || !userData.email) {
      log('Validation failed: Missing name or email');
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
    }
    
    // Check if email already exists
    const existingMember = members.find(m => m.email === userData.email);
    if (existingMember) {
      log('Signup failed: Email already exists');
      return res.status(400).json({
        success: false,
        error: 'This email is already registered'
      });
    }
    
    // Calculate new member data
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate proper initial SOLAR allocation:
    // 1. Everyone gets 1 SOLAR on the day they join
    const initialSolar = 1.0000; // Format with 4 decimal places (using 1.0000 format)
    
    // Check for "You are next" placeholder
    const placeholderIndex = members.findIndex(m => 
      m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
    
    // Generate member object
    const newMember = {
      id: members.length + (placeholderIndex !== -1 ? 0 : 1), // Adjust ID if replacing placeholder
      username: userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '.'),
      name: userData.name,
      email: userData.email,
      joinedDate: today,
      totalSolar: initialSolar, // Initial allocation with 4 decimal places
      totalDollars: Math.round(initialSolar * SOLAR_CONSTANTS.USD_PER_SOLAR),
      isAnonymous: userData.isAnonymous || false,
      lastDistributionDate: today // Set initial distribution date
    };
    
    log('Creating new member: ' + JSON.stringify(newMember));
    
    // Remove existing placeholder if it exists
    if (placeholderIndex !== -1) {
      log('Removing existing placeholder to ensure it goes at the end');
      members.splice(placeholderIndex, 1);
    }
    
    // Add the new member
    members.push(newMember);
    
    // Create a new placeholder and add it at the very end
    const newPlaceholder = {
      id: members.length + 1,
      username: "you.are.next",
      name: "You are next",
      joinedDate: today,
      totalSolar: initialSolar,
      totalDollars: Math.round(initialSolar * SOLAR_CONSTANTS.USD_PER_SOLAR),
      isAnonymous: false,
      lastDistributionDate: today
    };
    
    // Add new placeholder as the last entry
    members.push(newPlaceholder);
    
    // Update the files
    updateMembersFiles();
    
    log('Current member count: ' + members.length);
    
    // Return success response with accurate member count
    // The count should exclude the "you are next" placeholder in the count sent to the client
    const actualMemberCount = members.filter(m => !m.name.toLowerCase().includes("you are next")).length;
    
    res.status(201).json({ 
      success: true, 
      member: newMember,
      totalMembers: actualMemberCount
    });
  } catch (e) {
    log('Error processing signup: ' + e.message);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Process daily distributions for members
app.post('/api/process-distributions', (req, res) => {
  try {
    processDailyDistribution();
    res.json({ success: true, message: 'Distributions processed successfully' });
  } catch (e) {
    log('Error processing distributions: ' + e.message);
    res.status(500).json({ success: false, error: 'Failed to process distributions' });
  }
});

// API endpoint for getting live solar generation data
app.get('/api/solar-data', (req, res) => {
  const totalEnergy = calculateTotalEnergy();
  const totalValue = calculateTotalValue();
  
  // Calculate total SOLAR tokens
  const totalSolar = totalValue / SOLAR_CONSTANTS.USD_PER_SOLAR;
  
  res.json({
    energy: {
      value: totalEnergy,
      unit: 'MkWh'
    },
    solar: {
      value: parseFloat(totalSolar.toFixed(4)),
      formatted: totalSolar.toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      }),
      kwhPerSolar: SOLAR_CONSTANTS.KWH_PER_SOLAR,
      usdPerSolar: SOLAR_CONSTANTS.USD_PER_SOLAR
    },
    money: {
      value: totalValue,
      formatted: '$' + totalValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    },
    timestamp: new Date().toISOString()
  });
});

// API endpoint for getting just the member count
app.get('/api/member-count', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
  // Calculate actual member count, excluding the "you are next" placeholder
  const actualMemberCount = members.filter(m => !m.name.toLowerCase().includes("you are next")).length;
  
  res.json({
    count: actualMemberCount,
    timestamp: new Date().toISOString()
  });
});

// Serve static files
// Set no-cache headers for member data to prevent stale information
app.use('/api/members.json', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

app.use('/embedded-members', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Serve static files with cache control for JS files
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, path) => {
    // Set no-cache headers for JavaScript files to prevent stale code
    if (path.endsWith('.js')) {
      res.set({
        'Cache-Control': 'no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
  }
}));

// Fallback handler for SPA-like navigation (without using path-to-regexp)
app.use((req, res) => {
  // If the file doesn't exist, route to index.html
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #4caf50; }
          a { color: #4caf50; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p><a href="/">Return to Home</a></p>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  log(`The Current-See server running on port ${PORT}`);
  log(`Serving static files from: ${PUBLIC_DIR}`);
});

// Handle termination signals
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  process.exit(0);
});