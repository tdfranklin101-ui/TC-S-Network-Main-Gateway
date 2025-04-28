// Define main function to load members data
function loadMembersData() {
  let localMembers = [];
  
  try {
    // Attempt to load members from CSV file
    const csvMembers = loadMembersFromCSV(csvPath, currentDate);
    
    // Process CSV members if available
    if (csvMembers && csvMembers.length > 0) {
      // Update with current totals
      const processedMembers = updateMembersWithCurrentTotals(csvMembers, currentDate);
      localMembers = processedMembers;
      console.log(`Loaded and updated ${localMembers.length} members from CSV file`);
      
      // Update the file with current values
      try {
        fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
        console.log("Updated embedded.json with current SOLAR totals from CSV data");
      } catch (writeErr) {
        console.error("Error updating embedded.json file:", writeErr);
      }
    } else {
      // We only get here if CSV loading failed
      console.log("CSV loading failed, using default hardcoded members");
      
      // Default members with up-to-date SOLAR balances - FULL LIST
      const defaultMembers = [
        {
          id: 0,
          username: "tcs.reserve",
          name: "TC-S Solar Reserve",
          joinedDate: "2025-04-07", // Started on system launch date
          totalSolar: 10000000000, // 10 billion SOLAR fixed allocation
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        {
          id: 1,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          // Calculate days from April 9 to today (inclusive)
          totalSolar: calculateCurrentSolar("2025-04-09", currentDate),
          // $136,000 per SOLAR
          get totalDollars() { return this.totalSolar * 136000; },
          isAnonymous: false,
          lastDistributionDate: currentDate.toISOString().split('T')[0] // Today
        },
        // Add other members similarly
        // ...
      ];
  
      // Convert getter to actual property for JSON serialization
      const processedMembers = defaultMembers.map(member => ({
        ...member,
        totalSolar: parseFloat(member.totalSolar.toFixed(4)), // Format to 4 decimal places
        totalDollars: member.totalDollars // Use the computed value
      }));
  
      // Check for existing file or create new
      if (fs.existsSync(embeddedPath)) {
        localMembers = JSON.parse(fs.readFileSync(embeddedPath, 'utf8'));
        console.log(`Loaded ${localMembers.length} members from embedded data file`);
        
        // Update with current values if file exists
        localMembers = processedMembers;
        
        // Update the file with current values
        try {
          fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
          console.log("Updated embedded.json with current SOLAR totals");
        } catch (writeErr) {
          console.error("Error updating embedded.json file:", writeErr);
        }
      } else {
        // Use the processed default members
        localMembers = processedMembers;
        console.log("Using default members data with current SOLAR totals");
        
        // No need to create directory since we're using a direct file path
        // Make sure the public directory exists
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          try {
            fs.mkdirSync(publicDir, { recursive: true });
            console.log("Created public directory");
          } catch (mkdirErr) {
            console.error("Error creating public directory:", mkdirErr);
          }
        }
        
        // Write the default members to the embedded file
        try {
          fs.writeFileSync(embeddedPath, JSON.stringify(localMembers, null, 2));
          console.log("Created default embedded.json file with current SOLAR totals");
        } catch (writeErr) {
          console.error("Error writing embedded.json file:", writeErr);
        }
      }
    }
    
    // Return the members data
    return localMembers;
  } catch (err) {
    console.error("Error in loadMembersData function:", err);
    throw err; // Re-throw to be caught by the outer try-catch
  }
}