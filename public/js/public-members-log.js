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
      
      if (!Array.isArray(members)) {
        console.error('Invalid members data format:', members);
        return;
      }
      
      console.log(`Loaded ${members.length} members`);
      
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
    // Try to find the members table or the public-members-log div
    const membersTable = document.getElementById('members-table');
    const publicMembersLog = document.getElementById('public-members-log');
    
    // If neither element exists, we can't update anything
    if (!membersTable && !publicMembersLog) {
      console.log('No members display element found on this page');
      return;
    }
    
    // If we have the table element, update it (for traditional table)
    if (membersTable) {
      const tableBody = membersTable.querySelector('tbody');
      if (!tableBody) {
        console.log('Table body not found in members table');
        return;
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
        let solarAmount = 'N/A';
        if (typeof member.totalSolar === 'number') {
          solarAmount = member.totalSolar.toFixed(4);
        } else if (member.total_solar) {
          solarAmount = parseFloat(member.total_solar).toFixed(4);
        }
        
        // Create the row content with the member data
        row.innerHTML = `
          <td>${member.id}</td>
          <td>${member.name || 'Unknown'}</td>
          <td>${joinDate}</td>
          <td>${solarAmount} SOLAR</td>
        `;
        
        tableBody.appendChild(row);
      });
    }
    
    // If we have the public-members-log div, update it (for custom display)
    if (publicMembersLog) {
      console.log('Updating public members log display...');
      
      // Clear the current content
      publicMembersLog.innerHTML = '';
      
      // Create a table element with proper styling
      const table = document.createElement('table');
      table.className = 'members-log-table';
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.margin = '1rem 0';
      table.style.backgroundColor = '#fff';
      table.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      table.style.borderRadius = '4px';
      
      // Create table header
      const tableHead = document.createElement('thead');
      tableHead.innerHTML = `
        <tr>
          <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #7bc144; color: #333; font-weight: 600;">ID</th>
          <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #7bc144; color: #333; font-weight: 600;">Name</th>
          <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #7bc144; color: #333; font-weight: 600;">Joined</th>
          <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #7bc144; color: #333; font-weight: 600;">SOLAR</th>
        </tr>
      `;
      table.appendChild(tableHead);
      
      // Create table body
      const tableBody = document.createElement('tbody');
      
      // Filter out reserve accounts and sort by ID
      const visibleMembers = members
        .filter(member => {
          // Skip reserve accounts 
          const isReserve = member.isReserve || member.is_reserve;
          // Skip placeholder accounts
          const isPlaceholder = member.isPlaceholder || member.is_placeholder;
          return !isReserve && !isPlaceholder;
        })
        .sort((a, b) => {
          // Terry should be first
          if (a.name === "Terry D. Franklin") return -1;
          if (b.name === "Terry D. Franklin") return 1;
          
          // JF should be second
          if (a.name === "JF") return -1;
          if (b.name === "JF") return 1;
          
          // Otherwise sort by ID
          return parseInt(a.id) - parseInt(b.id);
        });
      
      console.log(`Filtered to ${visibleMembers.length} visible members`);
      
      // Add the members to the table
      visibleMembers.forEach(member => {
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
        let solarAmount = 'N/A';
        if (typeof member.totalSolar === 'number') {
          solarAmount = member.totalSolar.toFixed(4);
        } else if (member.total_solar) {
          solarAmount = parseFloat(member.total_solar).toFixed(4);
        }
        
        // Create a row for this member
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #eee';
        row.style.transition = 'background-color 0.2s';
        
        // Add hover effect
        row.onmouseover = function() { this.style.backgroundColor = '#f9f9f9'; };
        row.onmouseout = function() { this.style.backgroundColor = ''; };
        
        row.innerHTML = `
          <td style="padding: 12px 15px;">${member.id}</td>
          <td style="padding: 12px 15px; font-weight: 500;">${member.name || 'Unknown'}</td>
          <td style="padding: 12px 15px;">${joinDate}</td>
          <td style="padding: 12px 15px; color: #7bc144; font-weight: 600;">${solarAmount} SOLAR</td>
        `;
        
        tableBody.appendChild(row);
      });
      
      table.appendChild(tableBody);
      publicMembersLog.appendChild(table);
      
      // Add last updated timestamp
      const updated = document.createElement('div');
      updated.style.textAlign = 'right';
      updated.style.fontSize = '0.8rem';
      updated.style.color = '#999';
      updated.style.marginTop = '0.5rem';
      updated.textContent = `Last updated: ${new Date().toLocaleString()}`;
      publicMembersLog.appendChild(updated);
      
      console.log('Public members log display updated successfully');
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
    const member = members.find(m => parseInt(m.id) === memberId);
    if (!member) return;
    
    // Update member info elements
    updateElementText('member-name', member.name);
    updateElementText('member-id-display', member.id);
    updateElementText('member-join-date', formatDate(member.joinDate || member.joinedDate || member.joined_date));
    
    // Update solar amount with proper property checking
    let solarValue = null;
    if (typeof member.totalSolar === 'number') {
      solarValue = member.totalSolar;
    } else if (member.total_solar) {
      solarValue = parseFloat(member.total_solar);
    }
    
    if (solarValue !== null) {
      updateElementText('member-solar-amount', formatSolar(solarValue));
    }
    
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
    
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e, dateString);
      return dateString;
    }
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
    console.log('Public Members Log: Starting initial data load');
    refreshMembersData();
  });
  
  // For troubleshooting - show when script loads
  console.log('Public Members Log script loaded');
})();