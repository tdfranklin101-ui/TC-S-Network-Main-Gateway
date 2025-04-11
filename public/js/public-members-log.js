/**
 * Public Members Log Component
 * 
 * This component displays public Current-See members and their Solar accumulations
 * to motivate potential members to sign up.
 */
class PublicMembersLog {
  constructor(containerId) {
    console.log(`Initializing PublicMembersLog with container: ${containerId}`);
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with ID '${containerId}' not found`);
      // Try to create a fallback container for debugging
      const body = document.querySelector('body');
      if (body) {
        console.log('Creating fallback container for debugging');
        const fallbackContainer = document.createElement('div');
        fallbackContainer.id = containerId;
        fallbackContainer.style.margin = '20px';
        fallbackContainer.style.padding = '20px';
        fallbackContainer.style.border = '1px solid red';
        body.appendChild(fallbackContainer);
        this.container = fallbackContainer;
      } else {
        return;
      }
    }
    
    this.render();
    this.fetchMembers();
  }
  
  async fetchMembers() {
    try {
      console.log('Fetching members from leaderboard API...');
      const response = await fetch('/api/solar-accounts/leaderboard?limit=5');
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error(`Failed to fetch public members: ${response.status} ${response.statusText}`);
      }
      
      const members = await response.json();
      console.log('Members data received:', members);
      this.updateUI(members);
    } catch (error) {
      console.error('Error fetching members:', error);
      this.showError();
    }
  }
  
  updateUI(members) {
    console.log('Updating UI with members data');
    const membersContainer = this.container.querySelector('.members-list');
    
    if (!membersContainer) {
      console.error('Members list container not found within', this.container);
      // Create the members list if it doesn't exist
      const membersListDiv = document.createElement('div');
      membersListDiv.className = 'members-list';
      this.container.querySelector('.public-members-log')?.appendChild(membersListDiv);
      console.log('Created new members-list container');
      return;
    }
    
    if (!members || members.length === 0) {
      console.log('No members found, showing empty state');
      membersContainer.innerHTML = `
        <div class="empty-state">
          <p class="text-center">No public members yet.<br>Be the first to participate!</p>
          <div class="text-center mt-3">
            <a href="/my-solar" class="btn btn-primary">Join Now</a>
          </div>
        </div>
      `;
      return;
    }
    
    console.log(`Rendering ${members.length} members in the leaderboard`);
    membersContainer.innerHTML = '';
    
    members.forEach((member, index) => {
      try {
        const entryEl = document.createElement('div');
        entryEl.className = 'member-entry';
        
        // Safely format the solar amount with fallback
        let formattedSolar = '0.00000';
        try {
          formattedSolar = Number(member.totalSolar).toFixed(5);
        } catch (e) {
          console.error('Error formatting solar amount:', e);
        }
        
        entryEl.innerHTML = `
          <div class="member-rank">#${index + 1}</div>
          <div class="member-info">
            <div class="member-name">${member.displayName || 'Anonymous Member'}</div>
            <div class="member-solar">${formattedSolar} <small>SOLAR</small></div>
          </div>
        `;
        
        membersContainer.appendChild(entryEl);
      } catch (error) {
        console.error(`Error rendering member at index ${index}:`, error);
      }
    });
    
    // Show the "Join Now" button below the list
    const joinEl = document.createElement('div');
    joinEl.className = 'text-center mt-3';
    joinEl.innerHTML = `
      <a href="/my-solar" class="btn btn-primary">Join The Current-See</a>
    `;
    membersContainer.appendChild(joinEl);
    console.log('Finished rendering members leaderboard');
  }
  
  showError() {
    console.log('Showing error state');
    const membersContainer = this.container.querySelector('.members-list');
    
    if (!membersContainer) {
      console.error('Members list container not found when trying to show error');
      // Try to recreate the container structure if missing
      this.render();
      return;
    }
    
    membersContainer.innerHTML = `
      <div class="error-state">
        <p class="text-center">Unable to load member data.</p>
        <div class="text-center mt-3">
          <button class="btn btn-secondary" onclick="window.location.reload()">Retry</button>
          <a href="/my-solar" class="btn btn-primary">Join Now</a>
        </div>
      </div>
    `;
    console.log('Error state displayed with retry option');
  }
  
  render() {
    // Add CSS styles directly to the page
    if (!document.getElementById('members-log-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'members-log-styles';
      styleEl.textContent = `
        .public-members-log {
          background-color: rgba(255, 255, 255, 0.9);
          border-radius: 10px;
          padding: 1.5rem;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        .member-entry {
          display: flex;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .member-entry:last-of-type {
          border-bottom: none;
          margin-bottom: 1rem;
        }
        
        .member-rank {
          font-weight: bold;
          font-size: 1.2rem;
          margin-right: 1rem;
          color: #0057B8;
          min-width: 2rem;
        }
        
        .member-info {
          flex-grow: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .member-name {
          font-weight: 500;
          color: #0057B8;
        }
        
        .member-solar {
          font-weight: bold;
          color: #0057B8;
        }
        
        .member-solar small {
          font-size: 0.7rem;
          opacity: 0.7;
          margin-left: 2px;
        }
        
        .empty-state, .error-state {
          padding: 2rem 0;
          color: #0057B8;
        }
        
        .members-list .btn-primary {
          background-color: white;
          color: #0057B8;
          border: none;
          padding: 8px 20px;
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 30px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          margin-top: 1rem;
        }
        
        .members-list .btn-primary:hover {
          background-color: #0057B8;
          color: white;
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        .members-list .btn-secondary {
          background-color: #f1f1f1;
          color: #333;
          border: none;
          padding: 8px 20px;
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 30px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          margin-top: 1rem;
          margin-right: 10px;
          cursor: pointer;
        }
        
        .members-list .btn-secondary:hover {
          background-color: #ddd;
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        .loading-indicator {
          text-align: center;
          padding: 2rem 0;
          color: #0057B8;
        }
        
        .loading-spinner {
          display: inline-block;
          width: 2rem;
          height: 2rem;
          border: 3px solid rgba(0, 87, 184, 0.2);
          border-radius: 50%;
          border-top-color: #0057B8;
          animation: spin 1s ease-in-out infinite;
          margin-bottom: 1rem;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    // Create the component HTML
    this.container.innerHTML = `
      <div class="public-members-log">
        <div class="members-list">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <p>Loading members...</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize the component when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if the container exists before initializing
  if (document.getElementById('public-members-log')) {
    new PublicMembersLog('public-members-log');
  }
});