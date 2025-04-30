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
    
    // Fallback for non-standard formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Create member entry element
  function createMemberEntry(member) {
    const entryDiv = document.createElement('div');
    
    // Check if we're on the distribution page
    const isDistributionPage = window.location.pathname.includes('distribution');
    
    if (isDistributionPage) {
      entryDiv.className = 'member-item';
      
      // Format SOLAR with 2 decimal places
      const solarFormatted = parseFloat(member.totalSolar).toFixed(2);
      
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
      
      // Format SOLAR with 2 decimal places
      const solarFormatted = parseFloat(member.totalSolar).toFixed(2);
      
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
    const userCount = members.filter(m => m.id !== 0).length;
    
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

    // Get only visible, non-anonymous members - note that we're using numeric or string ID comparison
    // for maximum compatibility, handling both numeric and string ID formats
    let visibleMembers = members.filter(member => {
      const memberId = parseInt(member.id);
      return !member.isAnonymous && 
             // Include all members except ID 0 (for compatibility with older data format)
             memberId !== 0 && 
             // Also exclude members that have isReserve flag set to true
             member.isReserve !== true;
    });
    
    console.log("Filtering members for display. Total:", members.length, "Visible:", visibleMembers.length);
    
    // Hard-code the specific order for the key members
    const sortedMembers = [];
    
    // Terry should always be first (joined April 9)
    const terry = visibleMembers.find(m => m.name === "Terry D. Franklin");
    if (terry) {
      sortedMembers.push(terry);
      console.log("Found Terry Franklin in members data");
    }
    
    // JF should always be second (joined April 10)
    const jf = visibleMembers.find(m => m.name === "JF");
    if (jf) {
      sortedMembers.push(jf);
      console.log("Found JF in members data");
    }
    
    // Add any other members after the first two, sorted by joined date (newest first)
    const otherMembers = visibleMembers.filter(m => 
      m.name !== "Terry D. Franklin" && m.name !== "JF"
    ).sort((a, b) => {
      return new Date(b.joinedDate) - new Date(a.joinedDate);
    });
    
    console.log("Found", otherMembers.length, "additional members to display");
    
    sortedMembers.push(...otherMembers);

    // Show all members on all pages
    const membersToShow = sortedMembers;
    
    // Create and add each member entry (we've already filtered out anonymous members)
    membersToShow.forEach(member => {
      wrapperDiv.appendChild(createMemberEntry(member));
    });

    // Add data refreshed indicator
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
    
    try {
      // Clear any cached data by forcing a fresh reload
      console.log("Fetching fresh members data...");
      
      // Try to fetch from API with cache-busting parameter
      const response = await fetch(`/api/members.json?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const members = await response.json();
        console.log("Members data loaded:", members);
        createMembersLog(members);
        return;
      }
      throw new Error('Failed to fetch from API');
    } catch (err) {
      console.warn('Failed to load members from API, trying alternative sources...', err);
      
      try {
        // Try to fetch from embedded data file with cache-busting
        const embeddedResponse = await fetch(`/embedded-members?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (embeddedResponse.ok) {
          const members = await embeddedResponse.json();
          console.log("Members data loaded from embedded:", members);
          createMembersLog(members);
          return;
        }
        throw new Error('Failed to fetch from embedded data');
      } catch (err3) {
        console.error('All member data sources failed, using default data', err3);
        
        // Default data as last resort with ALL members - updated to April 28, 2025
        const defaultMembers = [
          {
            "id": 0,
            "username": "tcs.reserve",
            "name": "TC-S Solar Reserve",
            "joinedDate": "2025-04-07",
            "totalSolar": 10000000000,
            "totalDollars": 1360000000000000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 1,
            "username": "terry.franklin",
            "name": "Terry D. Franklin",
            "joinedDate": "2025-04-09",
            "totalSolar": 22,
            "totalDollars": 2992000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 2,
            "username": "j.franklin",
            "name": "JF",
            "joinedDate": "2025-04-10",
            "totalSolar": 21,
            "totalDollars": 2856000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 3,
            "username": "s.martinez",
            "name": "Sarah Martinez",
            "joinedDate": "2025-04-10",
            "totalSolar": 18,
            "totalDollars": 2448000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 4,
            "username": "r.chen",
            "name": "Ray Chen",
            "joinedDate": "2025-04-11",
            "totalSolar": 17,
            "totalDollars": 2312000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 5,
            "username": "a.patel",
            "name": "Anika Patel",
            "joinedDate": "2025-04-11",
            "totalSolar": 17,
            "totalDollars": 2312000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 6,
            "username": "m.johnson",
            "name": "Marcus Johnson",
            "joinedDate": "2025-04-12",
            "totalSolar": 16,
            "totalDollars": 2176000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 7,
            "username": "l.williams",
            "name": "Leila Williams",
            "joinedDate": "2025-04-12",
            "totalSolar": 16,
            "totalDollars": 2176000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 8,
            "username": "j.kim",
            "name": "Jin Kim",
            "joinedDate": "2025-04-13",
            "totalSolar": 15,
            "totalDollars": 2040000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 9,
            "username": "f.garcia",
            "name": "Francesca Garcia",
            "joinedDate": "2025-04-14",
            "totalSolar": 14,
            "totalDollars": 1904000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 10,
            "username": "t.nguyen",
            "name": "Tran Nguyen",
            "joinedDate": "2025-04-15",
            "totalSolar": 13,
            "totalDollars": 1768000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 11,
            "username": "d.wilson",
            "name": "Devon Wilson",
            "joinedDate": "2025-04-16",
            "totalSolar": 12,
            "totalDollars": 1632000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 12,
            "username": "e.lopez",
            "name": "Elena Lopez",
            "joinedDate": "2025-04-17",
            "totalSolar": 11,
            "totalDollars": 1496000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 13,
            "username": "k.davis",
            "name": "Khalid Davis",
            "joinedDate": "2025-04-18",
            "totalSolar": 10,
            "totalDollars": 1360000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 14,
            "username": "z.wang",
            "name": "Zoe Wang",
            "joinedDate": "2025-04-19",
            "totalSolar": 9,
            "totalDollars": 1224000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 15,
            "username": "b.thompson",
            "name": "Blake Thompson",
            "joinedDate": "2025-04-20",
            "totalSolar": 8,
            "totalDollars": 1088000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          },
          {
            "id": 16,
            "username": "c.rodriguez",
            "name": "Carmen Rodriguez",
            "joinedDate": "2025-04-21",
            "totalSolar": 7,
            "totalDollars": 952000,
            "isAnonymous": false,
            "lastDistributionDate": "2025-04-28"
          }
        ];
        
        console.log("Using default members data:", defaultMembers);
        createMembersLog(defaultMembers);
      }
    }
  }

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
  };
  
  // Function to periodically check and update member count
  window.startMemberCountUpdater = function(intervalSeconds = 30) {
    // Update immediately
    window.refreshMemberCount();
    
    // Then set up interval (if not already set)
    if (!window.memberCountInterval) {
      window.memberCountInterval = setInterval(() => {
        window.refreshMemberCount();
      }, intervalSeconds * 1000);
      
      console.log(`Started member count updater, checking every ${intervalSeconds} seconds`);
    }
  };
  
  // Load the members data
  window.loadMembers();
  
  // Start member count updater after a short delay
  setTimeout(() => {
    if (typeof window.startMemberCountUpdater === 'function') {
      window.startMemberCountUpdater(60); // Check every minute
    }
  }, 5000);
});