/**
 * TC-S Network Foundation Market - JavaScript Functionality
 * Powers the AI-curated digital artifact marketplace
 */

class MarketplaceApp {
  constructor() {
    this.artifacts = [];
    this.filteredArtifacts = [];
    this.currentUser = null;
    this.currentTab = 'browse';
    this.currentCategory = 'all';
    this.currentSort = 'newest';
    
    this.init();
  }

  async init() {
    console.log('🚀 Initializing TC-S Network Foundation Market...');
    
    // Initialize UI elements
    this.initializeElements();
    
    // Load user session
    await this.loadUserSession();
    
    // Load marketplace data
    await this.loadArtifacts();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial render
    this.render();
    
    console.log('✅ Marketplace initialized successfully');
  }

  initializeElements() {
    // Main containers
    this.artifactsGrid = document.getElementById('artifacts-grid');
    this.loadingEl = document.getElementById('loading');
    this.emptyStateEl = document.getElementById('empty-state');
    
    // Filters and tabs
    this.tabs = document.querySelectorAll('.tab');
    this.categoryFilter = document.getElementById('category-filter');
    this.sortFilter = document.getElementById('sort-filter');
    
    // User interface
    this.userInfo = document.getElementById('user-info');
    this.headerActions = document.getElementById('header-actions');
    
    // Modals
    this.videoModal = document.getElementById('video-preview-modal');
    this.signupModal = document.getElementById('signup-modal');
    this.signinModal = document.getElementById('signin-modal');
    
    console.log('📋 UI elements initialized');
  }

  async loadUserSession() {
    try {
      const response = await fetch('/api/session');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          this.currentUser = data.user;
          this.updateUserInterface();
          console.log(`👤 User session loaded: ${data.user.name}`);
        }
      }
    } catch (error) {
      console.warn('Session check failed:', error);
    }
  }

  async loadArtifacts() {
    try {
      this.showLoading(true);
      
      const response = await fetch('/api/artifacts/available');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.artifacts)) {
        this.artifacts = data.artifacts;
        this.applyFilters();
        console.log(`📦 Loaded ${this.artifacts.length} artifacts`);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
      
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      this.showError(`Failed to load marketplace: ${error.message}`);
    } finally {
      this.showLoading(false);
    }
  }

  setupEventListeners() {
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Filter changes
    if (this.categoryFilter) {
      this.categoryFilter.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.applyFilters();
      });
    }

    if (this.sortFilter) {
      this.sortFilter.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.applyFilters();
      });
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    // Modal event listeners
    this.setupModalListeners();

    // Upload form (if present)
    this.setupUploadForm();

    console.log('🎧 Event listeners configured');
  }

  setupModalListeners() {
    // Video preview modal
    if (this.videoModal) {
      const closeBtn = this.videoModal.querySelector('.video-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeVideoModal());
      }

      // Close on background click
      this.videoModal.addEventListener('click', (e) => {
        if (e.target === this.videoModal) {
          this.closeVideoModal();
        }
      });
    }

    // Signup modal
    if (this.signupModal) {
      const closeBtn = this.signupModal.querySelector('.btn-secondary');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeSignupModal());
      }
    }
  }

  setupUploadForm() {
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleUpload(e);
      });
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab visual state
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Show/hide relevant sections
    this.render();
    
    console.log(`📑 Switched to tab: ${tabName}`);
  }

  applyFilters() {
    let filtered = [...this.artifacts];

    // Filter by category
    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(artifact => 
        artifact.category === this.currentCategory
      );
    }

    // Filter by current tab
    if (this.currentTab === 'my-uploads' && this.currentUser) {
      filtered = filtered.filter(artifact => 
        artifact.creator_id === this.currentUser.id
      );
    }

    // Sort artifacts
    filtered.sort((a, b) => {
      switch (this.currentSort) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'price-low':
          return parseFloat(a.solar_amount_s) - parseFloat(b.solar_amount_s);
        case 'price-high':
          return parseFloat(b.solar_amount_s) - parseFloat(a.solar_amount_s);
        case 'popular':
          return (b.download_count || 0) - (a.download_count || 0);
        default:
          return 0;
      }
    });

    this.filteredArtifacts = filtered;
    this.render();
    
    console.log(`🔍 Applied filters: ${filtered.length}/${this.artifacts.length} artifacts`);
  }

  clearFilters() {
    this.currentCategory = 'all';
    this.currentSort = 'newest';
    
    if (this.categoryFilter) this.categoryFilter.value = 'all';
    if (this.sortFilter) this.sortFilter.value = 'newest';
    
    this.applyFilters();
  }

  render() {
    if (!this.artifactsGrid) return;

    // Hide all content sections first
    document.querySelectorAll('.tab-content').forEach(section => {
      section.style.display = 'none';
    });

    // Show current tab content
    const currentSection = document.getElementById(`${this.currentTab}-content`);
    if (currentSection) {
      currentSection.style.display = 'block';
    }

    // Render artifacts grid
    this.renderArtifactsGrid();
  }

  renderArtifactsGrid() {
    if (this.filteredArtifacts.length === 0) {
      this.showEmptyState();
      return;
    }

    this.artifactsGrid.innerHTML = '';
    this.hideEmptyState();

    this.filteredArtifacts.forEach(artifact => {
      const card = this.createArtifactCard(artifact);
      this.artifactsGrid.appendChild(card);
    });
  }

  createArtifactCard(artifact) {
    const card = document.createElement('div');
    card.className = 'artifact-card';
    card.dataset.artifactId = artifact.id;

    // Check if this artifact has AI-curated information
    const isAICurated = artifact.search_tags && artifact.search_tags.length > 0;
    const aiIcon = isAICurated ? '🤖 ' : '';

    card.innerHTML = `
      <div class="artifact-category">${aiIcon}${this.formatCategory(artifact.category)}</div>
      <h3 class="artifact-title">${this.escapeHtml(artifact.title)}</h3>
      <div class="artifact-price">${this.formatPrice(artifact.solar_amount_s)} Solar</div>
      <div class="artifact-kwh">${artifact.kwh_footprint || '0'} kWh footprint</div>
      
      ${isAICurated ? `
        <div class="artifact-bonus">AI-Curated</div>
      ` : ''}
      
      <div class="artifact-description">
        ${this.escapeHtml(artifact.description || 'No description available').substring(0, 120)}...
      </div>
      
      ${artifact.search_tags && artifact.search_tags.length > 0 ? `
        <div class="artifact-tags">
          ${artifact.search_tags.slice(0, 3).map(tag => 
            `<span class="tag">${this.escapeHtml(tag)}</span>`
          ).join('')}
        </div>
      ` : ''}

      <div class="artifact-actions">
        ${this.renderArtifactActions(artifact)}
      </div>
    `;

    // Add click handler for preview
    card.addEventListener('click', () => this.showArtifactPreview(artifact));

    return card;
  }

  renderArtifactActions(artifact) {
    const isOwner = this.currentUser && artifact.creator_id === this.currentUser.id;
    
    if (isOwner) {
      return `
        <button class="artifact-action-btn edit" onclick="event.stopPropagation(); marketplace.editArtifact('${artifact.id}')">
          ✏️ Edit
        </button>
        <button class="artifact-action-btn download" onclick="event.stopPropagation(); marketplace.downloadOwnArtifact('${artifact.id}')">
          📥 Download
        </button>
      `;
    } else if (this.currentUser) {
      return `
        <button class="purchase-btn" onclick="event.stopPropagation(); marketplace.purchaseArtifact('${artifact.id}')">
          💎 Purchase for ${this.formatPrice(artifact.solar_amount_s)} Solar
        </button>
        ${artifact.file_type.startsWith('video/') ? `
          <button class="preview-btn" onclick="event.stopPropagation(); marketplace.showVideoPreview('${artifact.id}')">
            ▶️ Preview Video
          </button>
        ` : ''}
      `;
    } else {
      return `
        <button class="purchase-btn" onclick="event.stopPropagation(); marketplace.showSignupModal()">
          🚀 Join to Purchase & Download
        </button>
      `;
    }
  }

  async showArtifactPreview(artifact) {
    console.log(`👁️ Showing preview for: ${artifact.title}`);
    
    // For video files, show video preview modal
    if (artifact.file_type.startsWith('video/')) {
      this.showVideoPreview(artifact.id);
      return;
    }

    // For non-video files, show AI-curated description or info modal
    this.showInfoModal(artifact);
  }

  async showVideoPreview(artifactId) {
    try {
      const artifact = this.artifacts.find(a => a.id === artifactId);
      if (!artifact) return;

      // Get secure preview URL
      const response = await fetch(`/api/artifacts/${artifactId}/preview`);
      if (!response.ok) {
        throw new Error('Preview not available');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load preview');
      }

      // Update modal content
      const modalTitle = this.videoModal.querySelector('.video-modal-header h3');
      const videoContainer = this.videoModal.querySelector('.video-container');
      const categoryEl = this.videoModal.querySelector('.video-category');
      const priceEl = this.videoModal.querySelector('.video-price');
      const purchaseBtn = this.videoModal.querySelector('.preview-purchase-btn');

      if (modalTitle) modalTitle.textContent = artifact.title;
      if (categoryEl) categoryEl.textContent = this.formatCategory(artifact.category);
      if (priceEl) priceEl.textContent = `${this.formatPrice(artifact.solar_amount_s)} Solar`;

      // Set up video element
      videoContainer.innerHTML = `
        <video controls style="width: 100%; max-height: 400px;">
          <source src="${data.previewUrl}" type="${artifact.file_type}">
          Your browser does not support video playback.
        </video>
      `;

      // Set up purchase button
      if (purchaseBtn) {
        purchaseBtn.onclick = () => {
          this.closeVideoModal();
          this.purchaseArtifact(artifactId);
        };
      }

      // Show modal
      this.videoModal.classList.add('visible');

    } catch (error) {
      console.error('Video preview failed:', error);
      this.showError(`Preview failed: ${error.message}`);
    }
  }

  showInfoModal(artifact) {
    // Create and show info modal for non-video artifacts
    const modal = document.createElement('div');
    modal.className = 'video-preview-modal visible';
    modal.innerHTML = `
      <div class="video-modal-content">
        <div class="video-modal-header">
          <h3>${this.escapeHtml(artifact.title)}</h3>
          <span class="video-close-btn">&times;</span>
        </div>
        <div style="padding: 20px;">
          <div class="video-category">${this.formatCategory(artifact.category)}</div>
          <p style="margin: 15px 0; line-height: 1.5;">
            ${this.escapeHtml(artifact.description || 'No description available')}
          </p>
          ${artifact.search_tags && artifact.search_tags.length > 0 ? `
            <div style="margin: 15px 0;">
              <strong>Tags:</strong> ${artifact.search_tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(' ')}
            </div>
          ` : ''}
          <div style="margin: 15px 0;">
            <strong>File Type:</strong> ${artifact.file_type}<br>
            <strong>Energy Footprint:</strong> ${artifact.kwh_footprint || '0'} kWh
          </div>
        </div>
        <div class="video-modal-footer">
          <div class="video-info">
            <div class="video-price">${this.formatPrice(artifact.solar_amount_s)} Solar</div>
          </div>
          <button class="preview-purchase-btn" onclick="marketplace.purchaseArtifact('${artifact.id}'); document.body.removeChild(this.closest('.video-preview-modal'));">
            💎 Purchase Now
          </button>
        </div>
      </div>
    `;

    // Add close functionality
    modal.querySelector('.video-close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  }

  closeVideoModal() {
    if (this.videoModal) {
      this.videoModal.classList.remove('visible');
      // Stop any playing video
      const video = this.videoModal.querySelector('video');
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }
  }

  async purchaseArtifact(artifactId) {
    if (!this.currentUser) {
      this.showSignupModal();
      return;
    }

    try {
      const artifact = this.artifacts.find(a => a.id === artifactId);
      if (!artifact) return;

      // Confirm purchase
      const confirmed = confirm(
        `Purchase "${artifact.title}" for ${this.formatPrice(artifact.solar_amount_s)} Solar?`
      );
      
      if (!confirmed) return;

      const response = await fetch(`/api/artifacts/${artifactId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Purchase successful');
        
        // Show success message and download link
        const modal = document.createElement('div');
        modal.className = 'video-preview-modal visible';
        modal.innerHTML = `
          <div class="video-modal-content">
            <div class="video-modal-header">
              <h3>🎉 Purchase Successful!</h3>
              <span class="video-close-btn">&times;</span>
            </div>
            <div style="padding: 20px; text-align: center;">
              <p>You've successfully purchased "${artifact.title}"!</p>
              <p style="margin: 15px 0;">Your download is ready:</p>
              <a href="${data.downloadUrl}" download="${artifact.title}" 
                 style="display: inline-block; background: #28a745; color: white; padding: 15px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px;">
                📥 Download Now
              </a>
              <p style="margin-top: 15px; font-size: 14px; color: #888;">
                Download link expires in ${data.expiresIn || '7 days'}
              </p>
            </div>
          </div>
        `;

        modal.querySelector('.video-close-btn').addEventListener('click', () => {
          document.body.removeChild(modal);
        });

        document.body.appendChild(modal);

        // Update user balance if provided
        if (data.newBalance !== undefined) {
          this.currentUser.solar_balance = data.newBalance;
          this.updateUserInterface();
        }

      } else {
        throw new Error(data.error || 'Purchase failed');
      }

    } catch (error) {
      console.error('Purchase failed:', error);
      this.showError(`Purchase failed: ${error.message}`);
    }
  }

  async handleUpload(event) {
    const form = event.target;
    const formData = new FormData(form);

    try {
      // Show upload progress
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '⏳ Uploading...';
      submitBtn.disabled = true;

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Upload successful:', data.message);
        
        // Show success message
        this.showSuccess(data.message);
        
        // Reset form
        form.reset();
        
        // Reload artifacts to show new upload
        await this.loadArtifacts();
        
        // Switch to my uploads tab
        this.switchTab('my-uploads');

      } else {
        throw new Error(data.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload failed:', error);
      this.showError(`Upload failed: ${error.message}`);
    } finally {
      // Reset button
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = '🚀 Upload to Market';
      submitBtn.disabled = false;
    }
  }

  showSignupModal() {
    if (this.signupModal) {
      this.signupModal.classList.add('visible');
    }
  }

  closeSignupModal() {
    if (this.signupModal) {
      this.signupModal.classList.remove('visible');
    }
  }

  showSigninModal() {
    if (this.signinModal) {
      this.signinModal.classList.add('visible');
    }
  }

  closeSigninModal() {
    if (this.signinModal) {
      this.signinModal.classList.remove('visible');
    }
  }

  updateUserInterface() {
    if (!this.currentUser) {
      // Show login/register buttons
      if (this.headerActions) {
        this.headerActions.innerHTML = `
          <a href="/login.html" class="register-btn">Login</a>
          <a href="/register.html" class="register-btn">Register</a>
        `;
      }
      return;
    }

    // Show user info
    if (this.userInfo) {
      this.userInfo.innerHTML = `
        <div class="user-details">
          <div>Welcome, <strong>${this.escapeHtml(this.currentUser.name)}</strong></div>
          <div class="solar-balance">${this.formatPrice(this.currentUser.solar_balance || 0)} Solar</div>
        </div>
      `;
      this.userInfo.classList.add('visible');
    }

    // Show user menu in header
    if (this.headerActions) {
      this.headerActions.innerHTML = `
        <div class="user-menu">
          <span>${this.escapeHtml(this.currentUser.name)}</span>
          <span class="solar-balance">${this.formatPrice(this.currentUser.solar_balance || 0)}☀️</span>
          <button class="logout-btn" onclick="marketplace.logout()">Logout</button>
        </div>
      `;
    }
  }

  async logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
      this.currentUser = null;
      this.updateUserInterface();
      this.applyFilters(); // Refresh view
      console.log('👋 Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Utility methods
  formatCategory(category) {
    const categoryMap = {
      'ai-tools': '🤖 AI Tools',
      'ai-automation': '⚙️ AI Automation', 
      'ai-creativity': '🎨 AI Creativity',
      'ai-analysis': '📊 AI Analysis',
      'ai-assistants': '💬 AI Assistants',
      'productivity': '📈 Productivity',
      'utilities': '🔧 Utilities',
      'games': '🎮 Games',
      'documents': '📄 Documents',
      'code-tools': '💻 Code Tools',
      'media-tools': '🎥 Media Tools',
      'data-tools': '📁 Data Tools',
      'music': '🎵 Music',
      'video': '🎬 Video',
      'software': '💻 Software'
    };
    
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  formatPrice(price) {
    const num = parseFloat(price);
    if (isNaN(num) || num == null) {
      return "0.0000"; // Return "0.0000" instead of "NaN" for invalid prices
    }
    if (num === 0) return '0.0000';
    
    let formatted = num.toFixed(4);
    if (parseFloat(formatted) === 0 && num > 0) {
      // Extend decimals if rounds to zero
      for (let decimals = 5; decimals <= 10; decimals++) {
        formatted = num.toFixed(decimals);
        if (parseFloat(formatted) > 0) break;
      }
    }
    return formatted;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    if (this.loadingEl) {
      this.loadingEl.style.display = show ? 'block' : 'none';
    }
    if (this.artifactsGrid) {
      this.artifactsGrid.style.display = show ? 'none' : 'grid';
    }
  }

  showEmptyState() {
    if (this.emptyStateEl) {
      this.emptyStateEl.style.display = 'block';
    }
    if (this.artifactsGrid) {
      this.artifactsGrid.style.display = 'none';
    }
  }

  hideEmptyState() {
    if (this.emptyStateEl) {
      this.emptyStateEl.style.display = 'none';
    }
    if (this.artifactsGrid) {
      this.artifactsGrid.style.display = 'grid';
    }
  }

  showError(message) {
    console.error('❌', message);
    // Create and show error toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 3000;
      max-width: 400px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 5000);
  }

  showSuccess(message) {
    console.log('✅', message);
    // Create and show success toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 3000;
      max-width: 400px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }
}

// Initialize marketplace when page loads
let marketplace;
document.addEventListener('DOMContentLoaded', () => {
  marketplace = new MarketplaceApp();
  // Make marketplace globally accessible for onclick handlers
  window.marketplace = marketplace;
});

// Global functions for HTML onclick handlers
window.togglePasswordVisibility = function(inputId) {
  const passwordInput = document.getElementById(inputId);
  const toggleButton = passwordInput.nextElementSibling;
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleButton.textContent = '🙈';
    toggleButton.style.color = '#ffaa00';
  } else {
    passwordInput.type = 'password';
    toggleButton.textContent = '👁️';
    toggleButton.style.color = '#888';
  }
};

window.signinUser = async function() {
  const username = document.getElementById('signin-username').value;
  const password = document.getElementById('signin-password').value;

  if (!username || !password) {
    alert('Username/email and password are required');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    const result = await response.json();

    if (response.ok) {
      // Update marketplace instance if available
      if (window.marketplace) {
        window.marketplace.currentUser = {
          userId: result.userId,
          username: result.username,
          solarBalance: result.solarBalance || 0
        };
        window.marketplace.updateUserInterface();
        window.marketplace.closeSigninModal();
      }
      
      alert(`🌱 Welcome back, ${result.username}! Balance: ${result.solarBalance} Solar`);
    } else {
      alert(`❌ Sign in failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Sign in error:', error);
    alert('❌ Network error during sign in');
  }
};

window.signupUser = async function() {
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const firstName = document.getElementById('signup-name').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  if (!username || !email || !password) {
    alert('Username, email, and password are required');
    return;
  }

  if (password !== passwordConfirm) {
    alert('Passwords do not match');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch('/api/users/signup-solar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        email: email,
        firstName: firstName,
        password: password
      })
    });

    const result = await response.json();

    if (response.ok) {
      // Update marketplace instance if available
      if (window.marketplace) {
        window.marketplace.currentUser = {
          userId: result.userId,
          username: result.username,
          solarBalance: result.solarBalance || result.initialSolarAmount || 0
        };
        window.marketplace.updateUserInterface();
        window.marketplace.closeSignupModal();
      }
      
      alert(result.message || `🌱 Welcome to TC-S Network, ${result.username}!`);
    } else {
      alert(`❌ Signup failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('❌ Network error during signup');
  }
};