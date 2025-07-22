// Default members in case no persistent data is found
const defaultMembers = [
  {
    id: 0,
    username: 'solar.reserve',
    name: 'Solar Reserve',
    email: 'admin@thecurrentsee.org',
    joinedDate: '2025-04-07',
    totalSolar: 10000000000,
    totalDollars: 1360000000000,
    isAnonymous: false,
    isReserve: true,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 1,
    username: 'terry.franklin',
    name: 'Terry D. Franklin',
    email: 'tdfranklin101@outlook.com',
    joinedDate: '2025-04-09',
    totalSolar: 11,
    totalDollars: 1496000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 2,
    username: 'jf',
    name: 'JF',
    email: 'aunsun27@icloud.com',
    joinedDate: '2025-04-10',
    totalSolar: 10,
    totalDollars: 1360000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 3,
    username: 'davis',
    name: 'Davis',
    email: 'Davisfranklin095@gmail.com',
    joinedDate: '2025-04-18',
    totalSolar: 3,
    totalDollars: 408000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 4,
    username: 'miles.franklin',
    name: 'Miles Franklin',
    email: 'Milesgfranklin9@gmail.com',
    joinedDate: '2025-04-18',
    totalSolar: 3,
    totalDollars: 408000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 5,
    username: 'arden.f',
    name: 'Arden F',
    email: 'arden@example.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 6,
    username: 'marissa.hasseman',
    name: 'Marissa Hasseman',
    email: 'marissa@example.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 7,
    username: 'kim',
    name: 'Kim',
    email: 'KIMBROWN9999@hotmail.com',
    joinedDate: '2025-04-19',
    totalSolar: 2,
    totalDollars: 272000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 8,
    username: 'jeff.elmore',
    name: 'Jeff Elmore',
    email: 'jeff@example.com',
    joinedDate: '2025-04-20',
    totalSolar: 1,
    totalDollars: 136000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  },
  {
    id: 9,
    username: 'liam.mckay',
    name: 'Liam McKay',
    email: 'liam@example.com',
    joinedDate: '2025-04-20',
    totalSolar: 1,
    totalDollars: 136000,
    isAnonymous: false,
    lastDistributionDate: '2025-04-20'
  }
];

// Function to load members from storage
function loadMembersFromStorage() {
  try {
    console.log('Attempting to load members from persistent storage...');
    const membersFilePath = 'public/api/members.json';
    const embeddedMembersPath = 'public/embedded-members';
    const backupDir = 'backup';
    
    // Track which file we loaded from for logging
    let sourceFile = 'none';
    
    // First try to load from members.json
    if (fs.existsSync(membersFilePath)) {
      try {
        const data = fs.readFileSync(membersFilePath, 'utf8');
        const loadedMembers = JSON.parse(data);
        if (loadedMembers && loadedMembers.length > 0) {
          console.log(`Loaded ${loadedMembers.length} members from members.json`);
          sourceFile = 'members.json';
          return { members: loadedMembers, source: sourceFile };
        }
      } catch (err) {
        console.error(`Error loading from members.json: ${err.message}`);
      }
    }
    
    // Then try embedded-members
    if (fs.existsSync(embeddedMembersPath)) {
      try {
        const data = fs.readFileSync(embeddedMembersPath, 'utf8');
        const match = data.match(/window\.embeddedMembers\s*=\s*(\[.*\]);/s);
        if (match && match[1]) {
          const loadedMembers = JSON.parse(match[1]);
          if (loadedMembers && loadedMembers.length > 0) {
            console.log(`Loaded ${loadedMembers.length} members from embedded-members`);
            sourceFile = 'embedded-members';
            return { members: loadedMembers, source: sourceFile };
          }
        }
      } catch (err) {
        console.error(`Error loading from embedded-members: ${err.message}`);
      }
    }
    
    // Finally try backups
    if (fs.existsSync(backupDir)) {
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.includes('members_backup') && file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first
      
      for (const backupFile of backupFiles) {
        const backupPath = path.join(backupDir, backupFile);
        try {
          const data = fs.readFileSync(backupPath, 'utf8');
          const loadedMembers = JSON.parse(data);
          if (loadedMembers && loadedMembers.length > 0) {
            console.log(`Loaded ${loadedMembers.length} members from backup: ${backupFile}`);
            sourceFile = backupFile;
            return { members: loadedMembers, source: sourceFile };
          }
        } catch (err) {
          console.error(`Error loading from backup ${backupFile}: ${err.message}`);
        }
      }
    }
    
    // If we couldn't load from any source, return default members
    console.log('No valid member data found in storage, using default members');
    return { members: defaultMembers, source: 'defaults' };
  } catch (err) {
    console.error(`Critical error loading members: ${err.message}`);
    return { members: defaultMembers, source: 'defaults (after error)' };
  }
}

// Load members from persistent storage or use defaults
const loadResult = loadMembersFromStorage();
const members = loadResult.members;
console.log(`Loaded ${members.length} members from ${loadResult.source}`);

// Ensure members are properly saved after loading
updateMembersFiles();