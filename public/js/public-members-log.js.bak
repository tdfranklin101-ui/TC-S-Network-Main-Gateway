/**
 * Public Members Log
 * Displays the list of registered members and their SOLAR balances
 */
document.addEventListener('DOMContentLoaded', function() {
  const membersLogContainer = document.getElementById('public-members-log');

  if (!membersLogContainer) {
    console.warn('Members log container not found on this page');
    return;
  }

  // Function to update the member count throughout the site
  function updateMemberCount(count) {
    const memberCountElements = document.querySelectorAll('.member-count, #member-count');
    memberCountElements.forEach(element => {
      element.textContent = count;
      
      // Add a subtle highlight animation
      element.style.transition = 'background-color 0.5s ease';
      const originalColor = window.getComputedStyle(element).backgroundColor;
      element.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      setTimeout(() => {
        element.style.backgroundColor = originalColor;
      }, 1000);
    });
  }
  
  // Helper function to format date
  function formatDate(dateString) {
    console.log("Original date string:", dateString);
    
    // Handle ISO format dates properly, forcing UTC interpretation to avoid timezone issues
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
      const day = parseInt(parts[2]);
      
      // Create date with explicit year, month, day components
      const date = new Date(Date.UTC(year, month, day));
      console.log("Created date object:", date);
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC' // Ensure UTC interpretation
      });
    }
    
    return dateString; // Return as-is if not in expected format
  }

  // Create member entry element
  function createMemberEntry(member) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'members-log-entry';

    // Get SOLAR value, checking both formats to ensure we get the correct value
    // For debugging
    console.log(`Member ${member.name} data:`, {
      totalSolar: member.totalSolar,
      total_solar: member.total_solar,
      type: typeof member.totalSolar
    });
    
    // CRUCIAL: For TC-S Solar Reserve and Solar Reserve, we need special formatting
    let solarFormatted;
    if (member.name === "TC-S Solar Reserve" || member.name === "Solar Reserve") {
      // Use scientific notation for the reserve entries to display number appropriately
      solarFormatted = (member.total_solar || member.totalSolar).toString();
    } else {
      // Handle all possible formats of solar values with robust fallbacks
      let solarValue = 0;
      
      // Check all possible property names and formats
      if (typeof member.total_solar === 'string' && member.total_solar) {
        solarValue = parseFloat(member.total_solar);
      } else if (typeof member.total_solar === 'number') {
        solarValue = member.total_solar;
      } else if (typeof member.totalSolar === 'string' && member.totalSolar) {
        solarValue = parseFloat(member.totalSolar);
      } else if (typeof member.totalSolar === 'number') {
        solarValue = member.totalSolar;
      }
      
      // Additional validation - ensure we have a valid number
      if (isNaN(solarValue)) {
        console.warn(`Invalid solar value for member ${member.name}, defaulting to 0`);
        solarValue = 0;
      }
      
      // Format regular members with 2 decimal places for display
      solarFormatted = solarValue.toFixed(2);
    }
    
    // Format date using consistent UTC approach
    const joinedDate = formatDate(member.joinedDate || member.joined_date);

    // Create the HTML with additional data attributes for debugging
    entryDiv.innerHTML = `
      <div class="member-name" data-id="${member.id}">${member.name}</div>
      <div class="member-joined" data-joined-date="${member.joinedDate || member.joined_date}">Joined: ${joinedDate}</div>
      <div class="member-solar" data-value="${member.total_solar || member.totalSolar}">SOLAR: ${solarFormatted}</div>
    `;

    return entryDiv;
  }

  // Function to create the members log
  function createMembersLog(members) {
    // Check if we have members data
    if (!members || !Array.isArray(members) || members.length === 0) {
      membersLogContainer.innerHTML = '<p>No members data available</p>';
      return;
    }
    
    // Filter out reserve accounts and placeholders for the count
    const actualMemberCount = members.filter(m => 
      !m.is_reserve && 
      m.name !== "You are next" && 
      m.id !== "next" && 
      !m.isPlaceholder && 
      !m.is_placeholder
    ).length;
    
    // Update member count display if element exists
    updateMemberCount(actualMemberCount);

    // Clear the container
    membersLogContainer.innerHTML = '';

    // Create a wrapper div
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'members-log-container';

    // Add a title if needed
    if (!document.querySelector('.members-log-section h2')) {
      const titleElement = document.createElement('h2');
      titleElement.className = 'members-log-title';
      titleElement.textContent = 'Public Members Log';
      wrapperDiv.appendChild(titleElement);
    }

    // Get only visible, non-anonymous members
    let visibleMembers = members.filter(member => !member.isAnonymous);
    
    // Hard-code the specific order for the key members
    const sortedMembers = [];
    
    // Terry should always be first (joined April 9)
    const terry = visibleMembers.find(m => m.name === "Terry D. Franklin");
    if (terry) {
      sortedMembers.push(terry);
    }
    
    // JF should always be second (joined April 10)
    const jf = visibleMembers.find(m => m.name === "JF");
    if (jf) {
      sortedMembers.push(jf);
    }
    
    // Find "You are next" placeholder
    const youAreNext = visibleMembers.find(m => 
      m.name === "You are next" || m.id === "next" || m.isPlaceholder === true
    );
    
    // Add any other members after the first two, sorted by joined date (oldest first)
    // Exclude both TDF, JF, and "You are next" from this set
    const otherMembers = visibleMembers.filter(m => 
      m.name !== "Terry D. Franklin" && 
      m.name !== "JF" && 
      m.name !== "You are next" && 
      m.id !== "next" && 
      m.isPlaceholder !== true
    ).sort((a, b) => {
      return new Date(a.joinedDate || a.joined_date) - new Date(b.joinedDate || b.joined_date);
    });
    
    // Add the regular members
    sortedMembers.push(...otherMembers);
    
    // Add "You are next" at the very end if it exists
    if (youAreNext) {
      sortedMembers.push(youAreNext);
    }

    // Add each member entry to the wrapper
    sortedMembers.forEach(member => {
      wrapperDiv.appendChild(createMemberEntry(member));
    });

    // Add data refreshed indicator
    const refreshedInfo = document.createElement('div');
    refreshedInfo.className = 'data-refreshed-info';
    refreshedInfo.style.fontSize = '0.7rem';
    refreshedInfo.style.color = '#777';
    refreshedInfo.style.textAlign = 'right';
    refreshedInfo.style.marginTop = '10px';
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    refreshedInfo.textContent = `Data refreshed: ${timeString}`;
    
    wrapperDiv.appendChild(refreshedInfo);
    
    // Add the wrapper to the container
    membersLogContainer.appendChild(wrapperDiv);
  }

  // Try to load from multiple sources with fallbacks
  // Make loadMembers function global so it can be called from other scripts
  window.loadMembers = async function() {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    console.log('=== LOADING MEMBERS DATA (UPDATED VERSION) ===');
    
    // Define an array of data sources to try in sequence
    const dataSources = [
      {
        name: 'Direct API fetch (members.json)',
        fetch: async () => {
          console.log("Trying direct API fetch from /api/members.json...");
          const response = await fetch(`/api/members.json?t=${timestamp}`, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) throw new Error('API response not OK');
          return await response.json();
        }
      },
      {
        name: 'EMBEDDED_MEMBERS global variable',
        fetch: async () => {
          console.log("Trying EMBEDDED_MEMBERS global variable...");
          if (!window.EMBEDDED_MEMBERS || !Array.isArray(window.EMBEDDED_MEMBERS)) {
            throw new Error('EMBEDDED_MEMBERS not available or not an array');
          }
          return window.EMBEDDED_MEMBERS;
        }
      },
      {
        name: 'Embedded members file (JavaScript)',
        fetch: async () => {
          console.log("Trying to fetch embedded-members file...");
          const response = await fetch(`/embedded-members?t=${timestamp}`, {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) throw new Error('Embedded file response not OK');
          
          // Parse the JavaScript content
          const text = await response.text();
          
          // Use script injection to evaluate
          const tempScript = document.createElement('script');
          tempScript.textContent = text;
          document.head.appendChild(tempScript);
          document.head.removeChild(tempScript);
          
          if (!window.EMBEDDED_MEMBERS || !Array.isArray(window.EMBEDDED_MEMBERS)) {
            throw new Error('Failed to parse embedded members file');
          }
          
          return window.EMBEDDED_MEMBERS;
        }
      }
    ];
    
    // Try each data source in sequence
    for (const source of dataSources) {
      try {
        console.log(`Attempting to load members from: ${source.name}`);
        const members = await source.fetch();
        
        if (!members || !Array.isArray(members) || members.length === 0) {
          console.warn(`${source.name} returned empty or invalid data`);
          continue;
        }
        
        console.log(`Successfully loaded ${members.length} members from ${source.name}`);
        console.log("First few members:", members.slice(0, 3));
        
        // Success - create the members log display
        createMembersLog(members);
        return;
      } catch (error) {
        console.warn(`Failed to load members from ${source.name}:`, error);
      }
    }
    
    // If we get here, all sources failed
    console.error('All member data sources failed');
    
    // Show error message to the user
    if (membersLogContainer) {
      membersLogContainer.innerHTML = `
        <div style="padding: 20px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">Unable to Load Member Data</h3>
          <p>We encountered a problem loading the member list. This might be due to connectivity issues or a temporary server problem.</p>
          <button onclick="window.loadMembers()" style="background-color: #7bc144; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
            Try Again
          </button>
        </div>
      `;
    }
  };

  // Function to just update the member count without loading the full member log
  window.refreshMemberCount = async function() {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      const response = await fetch(`/api/member-count?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        updateMemberCount(data.count);
        return data.count;
      }
    } catch (err) {
      console.warn('Failed to refresh member count', err);
      // If we fail to get the count, try loading full members data instead
      loadMembers();
    }
    return null;
  };

  // Force a fresh load of members data
  if (window.EMBEDDED_MEMBERS) {
    console.log("Using embedded members data:", window.EMBEDDED_MEMBERS.length, "members");
    
    // Immediately show the embedded members
    createMembersLog(window.EMBEDDED_MEMBERS);
    
    // Then try to load fresh data in the background
    setTimeout(() => {
      loadMembers().catch(err => {
        console.warn("Background refresh failed:", err);
      });
    }, 1000);
  } else {
    // No embedded data, load directly
    loadMembers();
  }
  
  // Set up refresh button click handler
  const refreshButton = document.getElementById('refresh-members-btn');
  if (refreshButton) {
    console.log('Setting up refresh button click handler');
    refreshButton.addEventListener('click', function() {
      this.innerHTML = '<span style="margin-right: 5px;">↻</span> Refreshing...';
      this.disabled = true;
      
      try {
        loadMembers()
          .catch(err => {
            console.error("Error refreshing members:", err);
            // Show error message briefly
            this.innerHTML = '<span style="margin-right: 5px;">⚠️</span> Error refreshing';
          })
          .finally(() => {
            // Always restore button state after a short delay
            setTimeout(() => {
              this.innerHTML = '<span style="margin-right: 5px;">↻</span> Refresh Members List';
              this.disabled = false;
            }, 1000);
          });
      } catch (err) {
        // Catch any synchronous errors
        console.error("Sync error refreshing members:", err);
        this.innerHTML = '<span style="margin-right: 5px;">↻</span> Refresh Members List';
        this.disabled = false;
      }
    });
  } else {
    console.log('Refresh button not found on page');
  }
  
  // Set up automatic refresh every 30 seconds if on a relevant page
  if (window.location.pathname.includes('solar-generator') || 
      window.location.pathname === '/' || 
      window.location.pathname === '/index.html') {
    console.log('Setting up automatic refresh for members data');
    setInterval(loadMembers, 30000); // Refresh every 30 seconds
  }
});