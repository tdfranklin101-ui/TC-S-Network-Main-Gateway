/**
 * Fixed Public Members Log - Updated May 2, 2025
 * Displays the list of registered members and their SOLAR balances
 * IMPORTANT: This version includes the TC-S Solar Reserve account
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
    // Handle ISO format dates properly, forcing UTC interpretation to avoid timezone issues
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
      const day = parseInt(parts[2]);
      
      // Create date with explicit year, month, day components
      const date = new Date(Date.UTC(year, month, day));
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC' // Ensure UTC interpretation
      });
    }
    
    // Fallback for non-standard formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Format SOLAR amount with proper precision
  function formatSolar(solarString) {
    const solarAmount = parseFloat(solarString);
    
    // Special formatting for very large amounts (reserve)
    if (solarAmount >= 1000000) {
      return solarAmount.toLocaleString('en-US', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
    
    // Regular formatting (2 decimal places)
    return solarAmount.toFixed(2);
  }

  // Create member entry element with special handling for TC-S Solar Reserve
  function createMemberEntry(member) {
    const entryDiv = document.createElement('div');
    
    // Check if we're on the distribution page
    const isDistributionPage = window.location.pathname.includes('distribution');

    // Special styling for reserve accounts
    const isReserve = (member.id === 0 || member.isReserve === true);
    
    if (isDistributionPage) {
      entryDiv.className = 'member-item';
      
      if (isReserve) {
        entryDiv.classList.add('reserve-account');
      }
      
      // Format SOLAR appropriately
      const solarFormatted = formatSolar(member.totalSolar);
      
      // Format date
      const joinedDate = formatDate(member.joinedDate);
      
      // Create simpler format for distribution page
      entryDiv.innerHTML = `
        <div class="member-name">${member.name}</div>
        <div class="member-details">
          <div class="joined-date">Joined: ${joinedDate}</div>
          <div class="solar-amount">SOLAR: ${solarFormatted}</div>
        </div>
      `;
    } else {
      entryDiv.className = 'members-log-entry';
      
      if (isReserve) {
        entryDiv.classList.add('reserve-account');
      }
      
      // Format SOLAR appropriately
      const solarFormatted = formatSolar(member.totalSolar);
      
      // Format date
      const joinedDate = formatDate(member.joinedDate);
      
      // Standard format for other pages
      entryDiv.innerHTML = `
        <div class="member-name">${member.name}</div>
        <div class="member-joined" data-joined-date="${member.joinedDate}">Joined: ${joinedDate}</div>
        <div class="member-solar">SOLAR: ${solarFormatted}</div>
      `;
    }
    
    return entryDiv;
  }

  // Function to create the members log
  function createMembersLog(members) {
    // Check if we have members data
    if (!members || !Array.isArray(members) || members.length === 0) {
      membersLogContainer.innerHTML = '<p>No members data available</p>';
      return;
    }
    
    // Get count of actual user members (excluding TC-S Solar Reserve)
    const userCount = members.filter(m => m.id !== 0 && !m.isReserve).length;
    
    // Update member count display if element exists
    updateMemberCount(userCount);

    // Clear the container
    membersLogContainer.innerHTML = '';

    // Check if we're on the distribution page
    const isDistributionPage = window.location.pathname.includes('distribution');
    
    // Create a wrapper div
    const wrapperDiv = document.createElement('div');
    
    // Different class based on page
    if (isDistributionPage) {
      wrapperDiv.className = 'distribution-members';
    } else {
      wrapperDiv.className = 'members-log-container';
    }

    // Add a title if needed, but not on distribution page (it already has one)
    if (!document.querySelector('.members-log-section h2') && !isDistributionPage) {
      const titleElement = document.createElement('h2');
      titleElement.className = 'members-log-title';
      titleElement.textContent = 'Public Members Log';
      wrapperDiv.appendChild(titleElement);
    }

    // Separate members into reserve and regular
    const reserveAccounts = members.filter(member => 
      member.id === 0 || member.isReserve === true
    );
    
    const regularMembers = members.filter(member => 
      member.id !== 0 && !member.isReserve && !member.isAnonymous
    );
    
    console.log("Found members - Reserve:", reserveAccounts.length, "Regular:", regularMembers.length);

    // Start with the reserve account - TC-S Solar Reserve
    reserveAccounts.forEach(reserve => {
      const reserveElement = createMemberEntry(reserve);
      wrapperDiv.appendChild(reserveElement);
    });

    // Add reserve/user separator if we have both types
    if (reserveAccounts.length > 0 && regularMembers.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'member-separator';
      separator.innerHTML = '<hr><span>Members</span><hr>';
      wrapperDiv.appendChild(separator);
    }
    
    // Sort regular members - Terry first, JF second, others by join date
    const sortedMembers = [];
    
    // Terry should always be first (joined April 9)
    const terry = regularMembers.find(m => m.name === "Terry D. Franklin");
    if (terry) {
      sortedMembers.push(terry);
      console.log("Found Terry Franklin in members data");
    }
    
    // JF should always be second (joined April 10)
    const jf = regularMembers.find(m => m.name === "JF");
    if (jf) {
      sortedMembers.push(jf);
      console.log("Found JF in members data");
    }
    
    // Add any other members after the first two, sorted by joined date (newest first)
    const otherMembers = regularMembers.filter(m => 
      m.name !== "Terry D. Franklin" && m.name !== "JF"
    ).sort((a, b) => {
      return new Date(b.joinedDate) - new Date(a.joinedDate);
    });
    
    console.log("Found", otherMembers.length, "additional members to display");
    
    sortedMembers.push(...otherMembers);

    // Add all regular members
    sortedMembers.forEach(member => {
      wrapperDiv.appendChild(createMemberEntry(member));
    });

    // Add data source and timestamp indicator
    const refreshedInfo = document.createElement('div');
    
    // Style differently based on page
    if (isDistributionPage) {
      refreshedInfo.className = 'data-refreshed';
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      refreshedInfo.textContent = `Data refreshed: ${timeString}`;
    } else {
      refreshedInfo.className = 'data-refreshed-info';
      refreshedInfo.style.fontSize = '0.7rem';
      refreshedInfo.style.color = '#777';
      refreshedInfo.style.textAlign = 'right';
      refreshedInfo.style.marginTop = '10px';
      
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      refreshedInfo.textContent = `Data refreshed: ${timeString}`;
    }
    
    wrapperDiv.appendChild(refreshedInfo);
    
    // Add the wrapper to the container
    membersLogContainer.appendChild(wrapperDiv);
  }

  // Try to load from multiple sources with fallbacks
  // Make loadMembers function global so it can be called from other scripts
  window.loadMembers = async function() {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    let fetchErrors = [];
    let dataSource = 'unknown';
    
    try {
      // Clear any cached data by forcing a fresh reload
      console.log("Fetching fresh members data...");
      
      // Strategy 1: First try the primary API endpoint
      try {
        console.log("Trying primary API endpoint...");
        const response = await fetch(`/api/members.json?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const members = await response.json();
          if (Array.isArray(members) && members.length > 0) {
            console.log(`Members data loaded from API: ${members.length} members`);
            
            // Check for TC-S Solar Reserve - ensure it's included
            let membersWithReserve = [...members];
            const hasReserve = members.some(m => m.name === "TC-S Solar Reserve" || m.id === 0);
            
            if (!hasReserve) {
              console.log("API response missing TC-S Solar Reserve - adding it manually");
              membersWithReserve.unshift({
                "id": 0,
                "username": "tcs.reserve",
                "name": "TC-S Solar Reserve",
                "joinedDate": "2025-04-07",
                "totalSolar": "10000000000",
                "totalDollars": "1360000000000000",
                "isAnonymous": false,
                "lastDistributionDate": "2025-05-02",
                "isReserve": true
              });
            }
            
            dataSource = 'live';
            createMembersLog(membersWithReserve);
            
            // Show data source indicator
            showDataSourceIndicator(dataSource);
            return;
          } else {
            console.warn("API returned empty or invalid data");
            fetchErrors.push("API returned empty data");
          }
        } else {
          console.warn(`API fetch failed with status: ${response.status}`);
          fetchErrors.push(`API: ${response.status}`);
        }
      } catch (apiError) {
        console.warn("API fetch error:", apiError);
        fetchErrors.push(`API error: ${apiError.message}`);
      }
      
      // Strategy 2: Try the embedded-members endpoint
      try {
        console.log("Trying embedded-members endpoint...");
        const embeddedResponse = await fetch(`/embedded-members?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (embeddedResponse.ok) {
          const members = await embeddedResponse.json();
          if (Array.isArray(members) && members.length > 0) {
            console.log(`Members data loaded from embedded endpoint: ${members.length} members`);
            
            // Check for TC-S Solar Reserve - ensure it's included
            let membersWithReserve = [...members];
            const hasReserve = members.some(m => m.name === "TC-S Solar Reserve" || m.id === 0);
            
            if (!hasReserve) {
              console.log("Embedded endpoint missing TC-S Solar Reserve - adding it manually");
              membersWithReserve.unshift({
                "id": 0,
                "username": "tcs.reserve",
                "name": "TC-S Solar Reserve",
                "joinedDate": "2025-04-07",
                "totalSolar": "10000000000",
                "totalDollars": "1360000000000000",
                "isAnonymous": false,
                "lastDistributionDate": "2025-05-02",
                "isReserve": true
              });
            }
            
            dataSource = 'embedded';
            createMembersLog(membersWithReserve);
            
            // Show data source indicator
            showDataSourceIndicator(dataSource);
            return;
          } else {
            console.warn("Embedded endpoint returned empty or invalid data");
            fetchErrors.push("Embedded endpoint returned empty data");
          }
        } else {
          console.warn(`Embedded endpoint fetch failed with status: ${embeddedResponse.status}`);
          fetchErrors.push(`Embedded endpoint: ${embeddedResponse.status}`);
        }
      } catch (embeddedError) {
        console.warn("Embedded endpoint error:", embeddedError);
        fetchErrors.push(`Embedded error: ${embeddedError.message}`);
      }
      
      // Strategy 3: Try direct access to the JSON file
      try {
        console.log("Trying direct JSON file access...");
        const jsonResponse = await fetch(`/embedded-members.json?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (jsonResponse.ok) {
          const members = await jsonResponse.json();
          if (Array.isArray(members) && members.length > 0) {
            console.log(`Members data loaded from JSON file: ${members.length} members`);
            
            // Check for TC-S Solar Reserve - ensure it's included
            let membersWithReserve = [...members];
            const hasReserve = members.some(m => m.name === "TC-S Solar Reserve" || m.id === 0);
            
            if (!hasReserve) {
              console.log("JSON file missing TC-S Solar Reserve - adding it manually");
              membersWithReserve.unshift({
                "id": 0,
                "username": "tcs.reserve",
                "name": "TC-S Solar Reserve",
                "joinedDate": "2025-04-07",
                "totalSolar": "10000000000",
                "totalDollars": "1360000000000000",
                "isAnonymous": false,
                "lastDistributionDate": "2025-05-02",
                "isReserve": true
              });
            }
            
            dataSource = 'file';
            createMembersLog(membersWithReserve);
            
            // Show data source indicator
            showDataSourceIndicator(dataSource);
            return;
          } else {
            console.warn("JSON file contained empty or invalid data");
            fetchErrors.push("JSON file contained empty data");
          }
        } else {
          console.warn(`JSON file fetch failed with status: ${jsonResponse.status}`);
          fetchErrors.push(`JSON file: ${jsonResponse.status}`);
        }
      } catch (jsonError) {
        console.warn("JSON file error:", jsonError);
        fetchErrors.push(`JSON file error: ${jsonError.message}`);
      }
      
      // If all dynamic sources failed, fall back to default data
      console.error('All member data sources failed:', fetchErrors);
      dataSource = 'fallback';
      
      // Default data as last resort - updated to May 2, 2025
      const defaultMembers = [
        {
          "id": 0,
          "username": "tcs.reserve",
          "name": "TC-S Solar Reserve",
          "joinedDate": "2025-04-07",
          "totalSolar": "10000000000",
          "totalDollars": "1360000000000000",
          "isAnonymous": false,
          "lastDistributionDate": "2025-05-02",
          "isReserve": true
        },
        {
          "id": 1,
          "username": "terry.franklin",
          "name": "Terry D. Franklin",
          "joinedDate": "2025-04-09",
          "totalSolar": "23",
          "totalDollars": "3128000",
          "isAnonymous": false,
          "lastDistributionDate": "2025-05-02",
          "isReserve": false
        },
        {
          "id": 2,
          "username": "j.franklin",
          "name": "JF",
          "joinedDate": "2025-04-10",
          "totalSolar": "22",
          "totalDollars": "2992000",
          "isAnonymous": false,
          "lastDistributionDate": "2025-05-02",
          "isReserve": false
        }
      ];
      
      createMembersLog(defaultMembers);
      
      // Show data source indicator
      showDataSourceIndicator(dataSource);
    } catch (error) {
      console.error('Fatal error loading members data:', error);
      membersLogContainer.innerHTML = '<div class="error-message">Error loading members data. Please try again later.</div>';
    }
  };
  
  // Function to display a colored indicator showing the data source
  function showDataSourceIndicator(source) {
    // Create or update the indicator
    let indicator = document.getElementById('data-source-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'data-source-indicator';
      indicator.style.position = 'fixed';
      indicator.style.bottom = '10px';
      indicator.style.right = '10px';
      indicator.style.width = '15px';
      indicator.style.height = '15px';
      indicator.style.borderRadius = '50%';
      indicator.style.zIndex = '9999';
      document.body.appendChild(indicator);
    }
    
    // Set color based on source
    switch(source) {
      case 'live':
        indicator.style.backgroundColor = '#4CAF50'; // Green
        indicator.title = 'Live data from API';
        break;
      case 'embedded':
        indicator.style.backgroundColor = '#FFC107'; // Yellow
        indicator.title = 'Data from embedded-members endpoint';
        break;
      case 'file':
        indicator.style.backgroundColor = '#2196F3'; // Blue
        indicator.title = 'Data from embedded-members.json file';
        break;
      case 'fallback':
        indicator.style.backgroundColor = '#F44336'; // Red
        indicator.title = 'Fallback data (API unavailable)';
        break;
      default:
        indicator.style.backgroundColor = '#9E9E9E'; // Gray
        indicator.title = 'Unknown data source';
    }
  }

  // Initialize members data load
  window.loadMembers();
  
  // Periodically refresh data
  setInterval(() => {
    window.loadMembers();
  }, 60000); // Refresh every 60 seconds
});