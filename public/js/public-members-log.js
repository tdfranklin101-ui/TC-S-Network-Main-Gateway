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

  // Helper function to format date
  function formatDate(dateString) {
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

    // Format SOLAR with 2 decimal places
    const solarFormatted = parseFloat(member.totalSolar).toFixed(2);
    
    // Format date
    const joinedDate = formatDate(member.joinedDate);

    entryDiv.innerHTML = `
      <div class="member-name">${member.name}</div>
      <div class="member-joined">Joined: ${joinedDate}</div>
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

    // Sort members by joined date (newest first)
    const sortedMembers = [...members].sort((a, b) => {
      return new Date(b.joinedDate) - new Date(a.joinedDate);
    });

    // Create and add each member entry
    sortedMembers.forEach(member => {
      if (!member.isAnonymous) {
        wrapperDiv.appendChild(createMemberEntry(member));
      }
    });

    // Add the wrapper to the container
    membersLogContainer.appendChild(wrapperDiv);
  }

  // Try to load from multiple sources with fallbacks
  async function loadMembers() {
    try {
      // Try to fetch from API
      const response = await fetch('/api/members.json');
      if (response.ok) {
        const members = await response.json();
        createMembersLog(members);
        return;
      }
      throw new Error('Failed to fetch from API');
    } catch (err) {
      console.warn('Failed to load members from API, trying alternative sources...', err);
      
      try {
        // Try to fetch from embedded data file
        const embeddedResponse = await fetch('/embedded-members');
        if (embeddedResponse.ok) {
          const members = await embeddedResponse.json();
          createMembersLog(members);
          return;
        }
        throw new Error('Failed to fetch from embedded data');
      } catch (err3) {
        console.error('All member data sources failed, using default data', err3);
        
        // Default data as last resort with BOTH members
        const defaultMembers = [
          {
            id: 1,
            username: "terry.franklin",
            name: "Terry D. Franklin",
            joinedDate: "2025-04-09",
            totalSolar: 8.00,
            totalDollars: 1088000,
            isAnonymous: false,
            lastDistributionDate: "2025-04-17"
          },
          {
            id: 2,
            username: "j.franklin",
            name: "JF",
            joinedDate: "2025-04-10",
            totalSolar: 7.00,
            totalDollars: 952000,
            isAnonymous: false,
            lastDistributionDate: "2025-04-17"
          }
        ];
        
        createMembersLog(defaultMembers);
      }
    }
  }

  // Load the members data
  loadMembers();
});