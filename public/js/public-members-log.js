/**
 * Public Members Log Component
 * 
 * This component displays public Current-See members and their Solar accumulations
 * to motivate potential members to sign up.
 */
class PublicMembersLog {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }
    
    this.render();
    this.fetchMembers();
  }
  
  async fetchMembers() {
    try {
      const response = await fetch('/api/solar-accounts/leaderboard?limit=5');
      if (!response.ok) throw new Error('Failed to fetch public members');
      
      const members = await response.json();
      this.updateUI(members);
    } catch (error) {
      console.error('Error fetching members:', error);
      this.showError();
    }
  }
  
  updateUI(members) {
    const membersContainer = this.container.querySelector('.members-list');
    
    if (members.length === 0) {
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
    
    membersContainer.innerHTML = '';
    
    members.forEach((member, index) => {
      const entryEl = document.createElement('div');
      entryEl.className = 'member-entry';
      
      entryEl.innerHTML = `
        <div class="member-rank">#${index + 1}</div>
        <div class="member-info">
          <div class="member-name">${member.displayName}</div>
          <div class="member-solar">${Number(member.totalSolar).toFixed(5)} <small>SOLAR</small></div>
        </div>
      `;
      
      membersContainer.appendChild(entryEl);
    });
    
    // Show the "Join Now" button below the list
    const joinEl = document.createElement('div');
    joinEl.className = 'text-center mt-3';
    joinEl.innerHTML = `
      <a href="/my-solar" class="btn btn-primary">Join The Current-See</a>
    `;
    membersContainer.appendChild(joinEl);
  }
  
  showError() {
    const membersContainer = this.container.querySelector('.members-list');
    membersContainer.innerHTML = `
      <div class="error-state">
        <p class="text-center">Unable to load member data.</p>
        <div class="text-center mt-3">
          <a href="/my-solar" class="btn btn-primary">Join Now</a>
        </div>
      </div>
    `;
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