/**
 * The Current-See Public Members Log
 * 
 * This script provides dynamic refresh capabilities for the members data
 * displayed on the website, ensuring users always see the most up-to-date
 * SOLAR distribution information without requiring page refreshes.
 */

(function() {
  // Keep track of the last fetch time to prevent too frequent refreshes
  let lastFetchTime = 0;
  const REFRESH_COOLDOWN = 30 * 1000; // 30 seconds minimum between refreshes
  
  /**
   * Refresh the members data by fetching from the server
   * Cache-busting is applied to ensure fresh data
   */
  async function refreshMembersData() {
    // Check if we should throttle the refresh
    const now = Date.now();
    if (now - lastFetchTime < REFRESH_COOLDOWN) {
      console.log('Refresh throttled - too soon since last refresh');
      return;
    }
    
    lastFetchTime = now;
    console.log('Refreshing members data...');
    
    try {
      // Fetch with cache-busting query parameter
      const response = await fetch(`/api/members.json?cache=${Math.random()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch members data');
        return;
      }
      
      const members = await response.json();
      
      // Update the members table if it exists on the page
      updateMembersDisplay(members);
      
      // Update any individual member displays (e.g., on account pages)
      updateIndividualMemberDisplay(members);
      
      // Update any counters or statistics
      updateMemberCounters(members);
      
      console.log(`Members data refreshed: ${members.length} members loaded`);
    } catch (error) {
      console.error('Error refreshing members data:', error);
    }
  }
  
  /**
   * Update the members table display
   */
  function updateMembersDisplay(members) {
    // Get the container
    const publicMembersLogContainer = document.getElementById('public-members-log');
    if (!publicMembersLogContainer) return;
    
    // Check if table exists, otherwise create it
    let membersTable = document.getElementById('members-table');
    let tableBody;
    
    if (!membersTable) {
      // Create the table structure if it doesn't exist
      membersTable = document.createElement('table');
      membersTable.id = 'members-table';
      membersTable.className = 'members-table';
      
      // Create table header
      const tableHeader = document.createElement('thead');
      tableHeader.innerHTML = `
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Join Date</th>
          <th>SOLAR Balance</th>
        </tr>
      `;
      
      // Create table body
      tableBody = document.createElement('tbody');
      
      // Assemble the table
      membersTable.appendChild(tableHeader);
      membersTable.appendChild(tableBody);
      
      // Add table to container
      publicMembersLogContainer.innerHTML = ''; // Clear any existing content
      publicMembersLogContainer.appendChild(membersTable);
    } else {
      tableBody = membersTable.querySelector('tbody');
      if (!tableBody) {
        tableBody = document.createElement('tbody');
        membersTable.appendChild(tableBody);
      }
    }
    
    // Clear the current table rows
    tableBody.innerHTML = '';
    
    // Add the updated members to the table
    members.forEach(member => {
      // Skip the reserve account in public tables
      if (member.isReserve || member.is_reserve) return;
      
      const row = document.createElement('tr');
      
      // Format the join date
      let joinDate = 'N/A';
      // Try different property names for join date
      const dateProperty = member.joinDate || member.joinedDate || member.joined_date;
      if (dateProperty) {
        try {
          joinDate = new Date(dateProperty).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        } catch (e) {
          console.error('Error formatting date:', e);
        }
      }
      
      // Format the solar amount with 4 decimal places
      const solarAmount = typeof member.totalSolar === 'number' 
        ? member.totalSolar.toFixed(4)
        : (member.total_solar || 'N/A');
      
      // Create the row content with the member data
      row.innerHTML = `
        <td>${member.id}</td>
        <td>${member.name || 'Unknown'}</td>
        <td>${joinDate}</td>
        <td>${solarAmount} SOLAR</td>
      `;
      
      tableBody.appendChild(row);
    });
    
    // Add some basic styling if no CSS exists for the table
    if (!document.querySelector('style#members-table-style')) {
      const style = document.createElement('style');
      style.id = 'members-table-style';
      style.innerHTML = `
        .members-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 0.9em;
          box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .members-table thead tr {
          background-color: #0057B8;
          color: #ffffff;
          text-align: left;
        }
        .members-table th,
        .members-table td {
          padding: 12px 15px;
        }
        .members-table tbody tr {
          border-bottom: 1px solid #dddddd;
        }
        .members-table tbody tr:nth-of-type(even) {
          background-color: #f3f3f3;
        }
        .members-table tbody tr:last-of-type {
          border-bottom: 2px solid #0057B8;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Update individual member displays (e.g., for account pages)
   */
  function updateIndividualMemberDisplay(members) {
    // Get the currently logged in member ID from the page data
    const memberIdElem = document.getElementById('current-member-id');
    if (!memberIdElem) return;
    
    const memberId = parseInt(memberIdElem.textContent, 10);
    if (isNaN(memberId)) return;
    
    // Find the member in the updated data
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    // Update member info elements
    updateElementText('member-name', member.name);
    updateElementText('member-id-display', member.id);
    updateElementText('member-join-date', formatDate(member.joinDate || member.joinedDate || member.joined_date));
    updateElementText('member-solar-amount', formatSolar(member.totalSolar || parseFloat(member.total_solar)));
    
    // Update any progress bars or visual indicators
    updateProgressBars(member);
  }
  
  /**
   * Update member statistics counters
   */
  function updateMemberCounters(members) {
    // Update total members count (excluding reserve account)
    const activeMembers = members.filter(m => !(m.isReserve || m.is_reserve)).length;
    updateElementText('total-members-count', activeMembers);
    
    // Update the total SOLAR distributed
    const totalSolar = members.reduce((sum, member) => {
      if (typeof member.totalSolar === 'number') {
        return sum + member.totalSolar;
      } else if (member.total_solar) {
        return sum + parseFloat(member.total_solar);
      }
      return sum;
    }, 0);
    
    updateElementText('total-solar-distributed', formatSolar(totalSolar));
    
    // Update the total value calculation
    const solarValue = 136000; // $136,000 per SOLAR
    const totalValue = totalSolar * solarValue;
    updateElementText('total-solar-value', formatCurrency(totalValue));
  }
  
  /**
   * Helper function to update text of an element if it exists
   */
  function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }
  
  /**
   * Helper function to format a date
   */
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Helper function to format SOLAR amounts
   */
  function formatSolar(amount) {
    if (typeof amount !== 'number') return 'N/A';
    return amount.toFixed(4) + ' SOLAR';
  }
  
  /**
   * Helper function to format currency values
   */
  function formatCurrency(amount) {
    if (typeof amount !== 'number') return 'N/A';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(amount);
  }
  
  /**
   * Helper function to update progress bars
   */
  function updateProgressBars(member) {
    const progressBar = document.getElementById('solar-progress-bar');
    if (!progressBar) return;
    
    let solarValue = 0;
    if (typeof member.totalSolar === 'number') {
      solarValue = member.totalSolar;
    } else if (member.total_solar) {
      solarValue = parseFloat(member.total_solar);
    }
    
    if (!isNaN(solarValue)) {
      // Progress is based on solar amount - you can modify this calculation as needed
      const progress = Math.min(100, solarValue * 10); // Eg: 10 solar = 100%
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    }
  }
  
  // Make the refresh function available globally
  window.refreshMembersData = refreshMembersData;
  
  // Set up automatic periodic refresh (every 5 minutes)
  setInterval(refreshMembersData, 5 * 60 * 1000);
  
  // Initial data load when the script runs
  document.addEventListener('DOMContentLoaded', function() {
    refreshMembersData();
  });
})();