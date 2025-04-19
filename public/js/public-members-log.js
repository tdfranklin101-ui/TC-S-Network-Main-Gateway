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
    entryDiv.className = 'members-log-entry';

    // Format SOLAR with 4 decimal places (showing values like 1.0001)
    const solarFormatted = parseFloat(member.totalSolar).toFixed(4);
    
    // Format date
    const joinedDate = formatDate(member.joinedDate);

    entryDiv.innerHTML = `
      <div class="member-name">${member.name}</div>
      <div class="member-joined" data-joined-date="${member.joinedDate}">Joined: ${joinedDate}</div>
      <div class="member-solar">SOLAR: ${solarFormatted}</div>
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
    
    // Update member count display if element exists
    updateMemberCount(members.length);

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
    
    // Separate the placeholder entry
    const placeholderIndex = visibleMembers.findIndex(m => 
      m.username === "you.are.next" && m.name.toLowerCase().includes("you are next"));
    
    let placeholder = null;
    if (placeholderIndex !== -1) {
      placeholder = visibleMembers[placeholderIndex];
      // Remove placeholder from visible members array
      visibleMembers = visibleMembers.filter(m => 
        !(m.username === "you.are.next" && m.name.toLowerCase().includes("you are next")));
    }
    
    // Terry should always be first (joined April 9)
    const terry = visibleMembers.find(m => m.name === "Terry D. Franklin");
    if (terry) {
      sortedMembers.push(terry);
      // Remove from array to avoid duplicates
      visibleMembers = visibleMembers.filter(m => m.name !== "Terry D. Franklin");
    }
    
    // JF should always be second (joined April 10)
    const jf = visibleMembers.find(m => m.name === "JF");
    if (jf) {
      sortedMembers.push(jf);
      // Remove from array to avoid duplicates
      visibleMembers = visibleMembers.filter(m => m.name !== "JF");
    }
    
    // Add remaining members sorted by joined date (oldest to newest)
    const otherMembers = visibleMembers.sort((a, b) => {
      return new Date(a.joinedDate) - new Date(b.joinedDate);
    });
    
    sortedMembers.push(...otherMembers);
    
    // Add placeholder at the end if it exists
    if (placeholder) {
      sortedMembers.push(placeholder);
    }

    // Create and add each member entry (we've already filtered out anonymous members)
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
    
    try {
      // Clear any cached data by forcing a fresh reload
      console.log("Fetching fresh members data...");
      
      // Force browser to clear its cache for this page
      if ('caches' in window) {
        try {
          const cacheNames = await window.caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => {
              return caches.delete(cacheName);
            })
          );
          console.log("Cleared browser caches");
        } catch (e) {
          console.warn("Failed to clear caches:", e);
        }
      }
      
      // Try to fetch from API with strict cache-busting parameter and random value
      const randomValue = Math.random().toString(36).substring(2, 15);
      const response = await fetch(`/api/members.json?nocache=${timestamp}&random=${randomValue}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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
        // Try to fetch from embedded data file with aggressive cache-busting
        const randomValue = Math.random().toString(36).substring(2, 15);
        const embeddedResponse = await fetch(`/embedded-members?nocache=${timestamp}&random=${randomValue}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
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
        
        // Default data as last resort with ALL members - updated to match current data
        const defaultMembers = [
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
            username: "you.are.next",
            name: "you are next",
            joinedDate: "2025-04-18",
            totalSolar: 2.0000,
            totalDollars: 272000,
            isAnonymous: false,
            lastDistributionDate: "2025-04-19"
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
      // Add timestamp and random value to prevent caching
      const timestamp = new Date().getTime();
      const randomValue = Math.random().toString(36).substring(2, 15);
      
      const response = await fetch(`/api/member-count?nocache=${timestamp}&random=${randomValue}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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