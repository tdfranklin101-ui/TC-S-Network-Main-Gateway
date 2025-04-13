/**
 * Public Members Log - Displays the list of Current-See members
 * 
 * This component shows the list of members who have joined The Current-See,
 * including their accumulated SOLAR units and equivalent monetary value.
 */

class PublicMembersLog {
  constructor(containerId = 'public-members-log') {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.members = [];
    this.memberCount = 0;
    this.pageSize = 10;
    this.currentPage = 1;
    this.loading = true;
    this.error = null;
    this.lastRefresh = 0;
    this.refreshInterval = 60 * 1000; // Refresh every minute
    this.apiEndpoints = [
      '/api/members',
      '/api/solar-accounts/leaderboard',
      '/api/members.json',
      '/api/members-data',
      '/api/public-api/members',
      '/api/members.js',
      '/embedded-members'
    ];
    
    console.log(`Initializing PublicMembersLog with container: ${containerId}`);
    
    if (!this.container) {
      console.error(`Container #${containerId} not found`);
      return;
    }
    
    this.render();
    this.loadMembers();
    
    // Set up periodic refresh
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastRefresh >= this.refreshInterval) {
        console.log('Refreshing members data...');
        this.loadMembers();
      }
    }, this.refreshInterval);
  }
  
  async loadMembers() {
    const isRefresh = !this.loading && this.members.length > 0;
    
    if (!isRefresh) {
      this.loading = true;
      this.error = null;
      this.render();
    }
    
    for (let i = 0; i < this.apiEndpoints.length; i++) {
      const endpoint = this.apiEndpoints[i];
      console.log(`Trying member endpoint ${i+1}/${this.apiEndpoints.length}: ${endpoint}`);
      
      try {
        let response;
        
        // Handle JSONP endpoint differently
        if (endpoint === '/api/members.js') {
          await this.loadMembersJSONP(endpoint);
          this.lastRefresh = Date.now();
          return;
        }
        
        // Handle iframe embedding
        if (endpoint === '/embedded-members') {
          await this.loadMembersIframe();
          this.lastRefresh = Date.now();
          return;
        }
        
        // Standard fetch with cache-busting query parameter
        response = await fetch(`${endpoint}?_=${Date.now()}${endpoint.includes('leaderboard') ? '&limit=5' : ''}`);
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`Unexpected content type from ${endpoint}:`, contentType);
          continue;
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          console.log(`Received array of ${data.length} members from ${endpoint}`);
          
          // Check if data has changed
          const hasChanged = this.hasDataChanged(this.members, data);
          
          this.members = data;
          this.loading = false;
          this.lastRefresh = Date.now();
          
          // Also try to get member count
          this.loadMemberCount();
          
          console.log('Updating UI with members data. Data changed:', hasChanged);
          this.render(hasChanged);
          
          return;
        } else if (data && data.members && Array.isArray(data.members)) {
          console.log(`Received ${data.members.length} members from ${endpoint}`);
          
          // Check if data has changed
          const hasChanged = this.hasDataChanged(this.members, data.members);
          
          this.members = data.members;
          this.memberCount = data.total || data.members.length;
          this.loading = false;
          this.lastRefresh = Date.now();
          
          this.render(hasChanged);
          return;
        }
      } catch (error) {
        console.error(`Error loading members from ${endpoint}:`, error);
      }
    }
    
    // If we reach here, all endpoints failed
    this.loading = false;
    if (!isRefresh) {
      this.error = 'Unable to load member data. Please try again later.';
      this.render();
    }
  }
  
  // Helper method to check if member data has changed
  hasDataChanged(oldData, newData) {
    if (!oldData || !newData || oldData.length !== newData.length) {
      return true;
    }
    
    for (let i = 0; i < oldData.length; i++) {
      const oldMember = oldData[i];
      const newMember = newData[i];
      
      // Check if any important properties have changed
      if (oldMember.totalSolar !== newMember.totalSolar ||
          oldMember.totalDollars !== newMember.totalDollars) {
        return true;
      }
    }
    
    return false;
  }
  
  async loadMembersJSONP(endpoint) {
    return new Promise((resolve, reject) => {
      // Create a global callback function
      window.updateMembers = (data) => {
        if (Array.isArray(data)) {
          this.members = data;
          this.loading = false;
          this.render();
          resolve(data);
        } else {
          this.error = 'Invalid data format received';
          this.loading = false;
          this.render();
          reject(new Error('Invalid data format'));
        }
        delete window.updateMembers;
      };
      
      // Create script element
      const script = document.createElement('script');
      script.src = `${endpoint}?callback=updateMembers&_=${Date.now()}`;
      script.onerror = () => {
        console.error('JS endpoint error:', {});
        delete window.updateMembers;
        reject(new Error('Script loading failed'));
      };
      document.body.appendChild(script);
      
      // Set timeout
      setTimeout(() => {
        if (window.updateMembers) {
          delete window.updateMembers;
          console.error(`Unexpected content type from ${endpoint}:`, 'text/html');
          reject(new Error('Script loading timed out'));
        }
      }, 3000);
    }).catch(error => {
      console.error(error);
    });
  }
  
  async loadMembersIframe() {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = '/members-embed.html';
      
      iframe.onload = () => {
        try {
          const data = iframe.contentWindow.membersData;
          if (data && Array.isArray(data)) {
            this.members = data;
            this.loading = false;
            this.render();
            resolve(data);
          } else {
            throw new Error('No data found in iframe');
          }
        } catch (error) {
          console.error('Error accessing iframe data:', {});
          reject(error);
        } finally {
          document.body.removeChild(iframe);
        }
      };
      
      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error('Iframe loading failed'));
      };
      
      document.body.appendChild(iframe);
    }).catch(error => {
      console.error(error);
    });
  }
  
  async loadMemberCount() {
    try {
      const response = await fetch('/api/member-count');
      const data = await response.json();
      if (data && typeof data.count === 'number') {
        this.memberCount = data.count;
        this.render();
      }
    } catch (error) {
      console.error('Error fetching member count:', {});
    }
  }
  
  formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
  
  formatSolar(value) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }
    return value.toFixed(2);
  }
  
  formatDollars(value) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }
    return '$' + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  
  render(hasChanged = false) {
    if (!this.container) return;
    
    let html = '';
    
    if (this.loading) {
      html = `
        <div class="public-members-log">
          <div class="loading-overlay">
            <div class="loading-spinner"></div>
          </div>
          <div class="members-header">
            <h2 class="members-title">Current-See Members</h2>
            <span class="members-count">Loading...</span>
          </div>
          <table class="members-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Member</th>
                <th>Joined</th>
                <th>SOLAR</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${Array(5).fill(0).map(() => `
                <tr>
                  <td colspan="5" style="height: 40px; background: #f7f7f7;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.error) {
      // Show error state
      console.log('Showing error state');
      html = `
        <div class="public-members-log">
          <div class="error-container">
            <h3 class="error-title">Unable to Load Members</h3>
            <p class="error-message">${this.error}</p>
            <button class="error-button" onclick="window.publicMembersLog.loadMembers()">
              Try Again
            </button>
          </div>
        </div>
      `;
      console.log('Error state displayed with retry option');
    } else {
      // Show members
      const displayMembers = this.members.slice(0, 5); // Just show the top 5 for the homepage
      const highlightClass = hasChanged ? 'highlight-updated' : '';
      
      console.log(`Rendering ${displayMembers.length} members in the leaderboard. Highlight changes: ${hasChanged}`);
      
      html = `
        <div class="public-members-log ${highlightClass}">
          <div class="members-header">
            <h2 class="members-title">Current-See Members</h2>
            <span class="members-count">${this.memberCount || displayMembers.length} Total</span>
            ${hasChanged ? '<span class="update-badge">Updated</span>' : ''}
          </div>
          
          <table class="members-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Member</th>
                <th>Joined</th>
                <th>SOLAR</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${displayMembers.map(member => {
                const memberId = member.id;
                const memberName = member.name || `${member.first_name || ''} ${member.last_name || ''}` || member.username || 'Anonymous Member';
                const joinedDate = this.formatDate(member.joinedDate || member.joined_date || member.created_at);
                const solarAmount = this.formatSolar(member.totalSolar || member.total_solar || 1);
                const dollarValue = this.formatDollars(member.totalDollars || member.total_dollars || 136000);
                const isAnonymous = member.isAnonymous || member.is_anonymous;
                
                return `
                  <tr class="${isAnonymous ? 'member-anonymous' : ''} ${hasChanged ? 'highlight-row' : ''}">
                    <td class="member-id">#${memberId}</td>
                    <td class="member-name">${isAnonymous ? 'Anonymous Member' : memberName}</td>
                    <td class="member-joined">${joinedDate}</td>
                    <td class="member-solar ${hasChanged ? 'highlight-cell' : ''}">${solarAmount}</td>
                    <td class="member-value ${hasChanged ? 'highlight-cell' : ''}">${dollarValue}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="members-actions">
            <div class="last-updated">
              ${this.lastRefresh ? `Last updated: ${new Date(this.lastRefresh).toLocaleTimeString()}` : ''}
            </div>
            <a href="/members.html" class="view-all-button">View All Members</a>
          </div>
        </div>
      `;
      
      console.log('Finished rendering members leaderboard');
    }
    
    this.container.innerHTML = html;
    
    // Add animation removal after delay if highlighting changes
    if (hasChanged) {
      setTimeout(() => {
        const highlights = this.container.querySelectorAll('.highlight-cell, .highlight-row, .highlight-updated, .update-badge');
        highlights.forEach(el => {
          if (el.classList.contains('update-badge')) {
            el.style.opacity = '0';
          } else {
            el.classList.remove('highlight-cell', 'highlight-row', 'highlight-updated');
          }
        });
      }, 3000);
    }
  }
  
  retry() {
    this.loadMembers();
  }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.publicMembersLog = new PublicMembersLog();
});