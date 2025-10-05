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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/session', {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          console.warn('Invalid session response structure');
          return;
        }
        
        if (data.success && data.user && typeof data.user === 'object') {
          this.currentUser = {
            ...data.user,
            id: data.user.id || null,
            username: data.user.username || 'Unknown User'
          };
          this.userProfile = data.userProfile || null;
          this.solarBalance = parseFloat(data.solarBalance) || 0;
          this.updateUserInterface();
          console.log(`👤 User session loaded: ${this.currentUser.username} (${this.solarBalance} Solar)`);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Session check timed out');
      } else {
        console.warn('Session check failed:', error.message || error);
      }
      // Set safe defaults
      this.currentUser = null;
      this.userProfile = null;
      this.solarBalance = 0;
    }
  }

  async loadArtifacts() {
    try {
      this.showLoading(true);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout for artifacts
      
      const response = await fetch('/api/artifacts/available', {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format: expected JSON object');
      }
      
      if (data.success && Array.isArray(data.artifacts)) {
        // Normalize and validate artifact data with comprehensive error handling
        this.artifacts = data.artifacts.map((artifact, index) => {
          try {
            // Ensure required fields exist
            if (!artifact || typeof artifact !== 'object') {
              console.warn(`Invalid artifact at index ${index}:`, artifact);
              return null;
            }
            
            return {
              id: artifact.id || `missing-id-${index}`,
              title: String(artifact.title || 'Untitled').trim() || 'Untitled',
              description: String(artifact.description || '').trim(),
              category: String(artifact.category || 'other').toLowerCase(),
              kwh_footprint: parseFloat(artifact.kwh_footprint || artifact.kwhFootprint) || 0,
              solar_amount_s: parseFloat(artifact.solar_amount_s || artifact.solarPrice) || 0,
              is_bonus: Boolean(artifact.is_bonus || artifact.isBonus),
              cover_art_url: String(artifact.cover_art_url || artifact.coverArt || '').trim(),
              delivery_mode: String(artifact.delivery_mode || artifact.deliveryMode || 'download').toLowerCase(),
              creator_id: String(artifact.creator_id || artifact.creatorId || 'unknown'),
              created_at: artifact.created_at || artifact.dateAdded || new Date().toISOString(),
              file_type: String(artifact.file_type || artifact.fileType || 'application/octet-stream').toLowerCase(),
              active: Boolean(artifact.active !== false), // Default to true unless explicitly false
              status: String(artifact.status || 'approved').toLowerCase()
            };
          } catch (normalizationError) {
            console.warn(`Error normalizing artifact at index ${index}:`, normalizationError);
            return null;
          }
        }).filter(artifact => artifact !== null); // Remove invalid artifacts
        
        this.applyFilters();
        console.log(`📦 Loaded ${this.artifacts.length} artifacts (${data.artifacts.length - this.artifacts.length} invalid artifacts filtered)`);
      } else if (data.success && !Array.isArray(data.artifacts)) {
        throw new Error('Invalid artifacts data: expected array');
      } else {
        throw new Error(data.error || 'No artifacts data received');
      }
      
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to load marketplace';
      if (error.name === 'AbortError') {
        errorMessage = 'Marketplace loading timed out. Please check your connection and try again.';
      } else if (error.message.includes('HTTP')) {
        errorMessage = 'Server error while loading marketplace. Please try again later.';
      } else {
        errorMessage = `Failed to load marketplace: ${error.message}`;
      }
      
      this.showError(errorMessage);
      
      // Set safe fallback
      this.artifacts = [];
    } finally {
      this.showLoading(false);
    }
  }

  async loadMyItems() {
    try {
      this.showLoading(true);
      
      const response = await fetch('/api/artifacts/my-items');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Combine uploaded and purchased artifacts for display
        const uploadedArtifacts = data.uploaded?.artifacts || [];
        const purchasedArtifacts = data.purchased?.artifacts || [];
        
        // For My Items tab, we primarily show uploaded artifacts with status info
        this.artifacts = uploadedArtifacts.map(artifact => ({
          id: artifact.id,
          title: artifact.title,
          description: artifact.description,
          category: artifact.category,
          kwh_footprint: artifact.kwhFootprint,
          solar_amount_s: artifact.solarPrice,
          is_bonus: artifact.isBonus,
          cover_art_url: artifact.coverArt,
          delivery_mode: artifact.deliveryMode,
          creatorId: artifact.creatorId,
          created_at: artifact.dateAdded,
          file_type: artifact.fileType || 'application/octet-stream',
          active: artifact.active,
          status: artifact.status,
          search_tags: []
        }));
        
        this.applyFilters();
        console.log(`📋 Loaded ${this.artifacts.length} user artifacts`);
      } else {
        console.error('Invalid my items data:', data);
        this.artifacts = [];
      }
    } catch (error) {
      console.error('Failed to load my items:', error);
      this.showError('Failed to load your items');
      this.artifacts = [];
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

  updateUserInterface() {
    const headerActions = document.getElementById('header-actions');
    if (!headerActions) return;

    // Sync with global currentUser variable for legacy functions
    if (typeof window !== 'undefined') {
      window.currentUser = this.currentUser ? {
        userId: this.currentUser.id,
        username: this.currentUser.username,
        solarBalance: this.solarBalance || 0,
        ...this.currentUser
      } : null;
    }

    if (this.currentUser) {
      // Show member status with initial/emoji and Solar balance
      const userInitial = this.currentUser.firstName ? this.currentUser.firstName.charAt(0).toUpperCase() : 
                         this.currentUser.username ? this.currentUser.username.charAt(0).toUpperCase() : '👤';
      
      // Format balance consistently
      const formattedBalance = (this.solarBalance || 0).toFixed(4);
      
      headerActions.innerHTML = `
        <div class="user-menu">
          <div class="user-avatar">${userInitial}</div>
          <div class="user-info">
            <div class="user-name">${this.currentUser.firstName || this.currentUser.username}</div>
            <div class="solar-balance">${formattedBalance} Solar</div>
          </div>
          <button class="logout-btn" onclick="marketplace.logout()">Logout</button>
        </div>
      `;
    } else {
      // Show register/login buttons for non-authenticated users
      headerActions.innerHTML = `
        <a href="/signup.html" class="register-btn">Join TC-S Network</a>
      `;
    }
  }

  async logout() {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        this.currentUser = null;
        this.userProfile = null;
        this.solarBalance = 0;
        this.updateUserInterface();
        // Reload artifacts to update "My Items" view
        await this.loadArtifacts();
        console.log('👋 User logged out successfully');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
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

      // File input handling
      const fileInput = document.getElementById('artifact-file');
      const titleInput = document.getElementById('artifact-title');
      const emailInput = document.getElementById('creator-email');
      const categorySelect = document.getElementById('artifact-category');
      const submitBtn = document.querySelector('.upload-submit-btn');

      if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
          await this.handleFileSelection(e);
        });
      }

      // Form validation
      const validateForm = () => {
        const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
        const hasTitle = titleInput && titleInput.value.trim().length > 0;
        const hasEmail = emailInput && emailInput.value.trim().length > 0;
        const hasCategory = categorySelect && categorySelect.value.trim().length > 0;
        
        if (submitBtn) {
          submitBtn.disabled = !(hasFile && hasTitle && hasEmail && hasCategory);
        }
      };

      // Add event listeners for form validation
      [titleInput, emailInput, categorySelect].forEach(element => {
        if (element) {
          element.addEventListener('input', validateForm);
          element.addEventListener('change', validateForm);
        }
      });
    }
  }

  async handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('🔄 File selected:', file.name, file.type, file.size);

    // Show file preview
    this.displayFilePreview(file);

    // Start TC Identity Sync analysis
    await this.analyzeWithTCIdentity(file);
  }

  displayFilePreview(file) {
    const preview = document.getElementById('file-preview');
    const uploadArea = document.querySelector('.file-upload-area .upload-placeholder');
    
    if (preview && uploadArea) {
      // Update upload area
      uploadArea.innerHTML = `
        <div class="upload-icon">✅</div>
        <div class="upload-text">${file.name}</div>
        <div class="upload-hint">${this.formatFileSize(file.size)} • ${file.type}</div>
      `;

      // Show preview section
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="color: #28a745; font-weight: 600;">📁 File Ready:</div>
        <div style="color: #ffffff; margin-top: 5px;">${file.name}</div>
        <div style="color: #888; font-size: 12px; margin-top: 5px;">
          ${this.formatFileSize(file.size)} • ${file.type}
        </div>
      `;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async analyzeWithTCIdentity(file) {
    const analysisSection = document.getElementById('ai-analysis-section');
    const analysisStatus = document.getElementById('analysis-status');
    const analysisResults = document.getElementById('analysis-results');
    const pricingSection = document.getElementById('pricing-section');

    if (!analysisSection || !analysisStatus || !analysisResults) {
      console.error('Analysis UI elements not found');
      return;
    }

    // Show analysis section
    analysisSection.style.display = 'block';
    analysisStatus.textContent = 'Analyzing with TC Identity Sync...';
    analysisStatus.className = 'analysis-status';

    try {
      console.log('🤖 Starting TC Identity Sync analysis...');

      // Prepare form data for TC Identity Sync
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', document.getElementById('artifact-title').value || file.name);

      // Call TC Identity Sync API
      const response = await fetch('https://tc-identity-sync-tdfranklin101.replit.app/api/analyze', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`TC Identity Sync API error: ${response.status}`);
      }

      const analysisData = await response.json();
      console.log('✅ TC Identity Sync analysis complete:', analysisData);

      // Store analysis data for upload
      this.lastAnalysisData = analysisData;

      // Display analysis results
      this.displayAnalysisResults(analysisData);

      // Calculate and display Solar pricing
      this.calculateSolarPricing(analysisData);

      analysisStatus.textContent = 'Analysis Complete!';
      analysisStatus.style.background = '#28a745';

    } catch (error) {
      console.error('❌ TC Identity Sync analysis failed:', error);
      
      // Fallback to basic analysis
      const fallbackData = await this.performFallbackAnalysis(file);
      
      // Store fallback analysis data for upload
      this.lastAnalysisData = fallbackData;
      
      this.displayAnalysisResults(fallbackData);
      this.calculateSolarPricing(fallbackData);

      analysisStatus.textContent = 'Using Basic Analysis';
      analysisStatus.style.background = '#ff6b35';
    }
  }

  displayAnalysisResults(data) {
    const resultsDiv = document.getElementById('analysis-results');
    if (!resultsDiv) return;

    const aiSees = data.what_ai_sees || data.analysis || 'Digital content item';
    const category = data.suggested_category || 'other';
    const confidence = data.confidence || 85;
    const kwhValue = data.kwh_estimate || this.estimateKwh(data);

    resultsDiv.innerHTML = `
      <div class="analysis-item">
        <strong>🤖 What the AI Sees:</strong>
        <div style="margin-top: 8px; padding: 12px; background: rgba(40, 167, 69, 0.1); border-radius: 6px; color: #28a745;">
          ${aiSees}
        </div>
      </div>
      <div class="analysis-item" style="margin-top: 15px;">
        <strong>📊 Analysis Details:</strong>
        <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>Category: <span style="color: #28a745;">${category}</span></div>
          <div>Confidence: <span style="color: #28a745;">${confidence}%</span></div>
          <div>kWh Estimate: <span style="color: #28a745;">${kwhValue}</span></div>
          <div>Value Score: <span style="color: #28a745;">${data.value_score || 'Medium'}</span></div>
        </div>
      </div>
    `;

    // Auto-fill category if suggested
    const categorySelect = document.getElementById('artifact-category');
    if (categorySelect && data.suggested_category) {
      const categoryMap = {
        'art': 'art',
        'music': 'music',
        'audio': 'music',
        'video': 'video',
        'document': 'document',
        'software': 'software',
        'app': 'software'
      };
      
      const mappedCategory = categoryMap[data.suggested_category.toLowerCase()] || 'other';
      categorySelect.value = mappedCategory;
      categorySelect.dispatchEvent(new Event('change')); // Trigger validation
    }
  }

  calculateSolarPricing(data) {
    const pricingSection = document.getElementById('pricing-section');
    const priceInput = document.getElementById('solar-price');
    const kwhConversion = document.getElementById('kwh-conversion');

    if (!pricingSection || !priceInput || !kwhConversion) return;

    // Show pricing section
    pricingSection.style.display = 'block';

    // Calculate Solar price from kWh
    const kwhValue = parseFloat(data.kwh_estimate) || this.estimateKwh(data);
    const kwhToSolarRate = 0.0002; // 1 kWh = 0.0002 Solar (example rate)
    const baseSolarPrice = kwhValue * kwhToSolarRate;
    
    // Apply category and value modifiers
    const categoryMultiplier = this.getCategoryMultiplier(data.suggested_category);
    const valueMultiplier = this.getValueMultiplier(data.value_score);
    
    let finalPrice = baseSolarPrice * categoryMultiplier * valueMultiplier;
    
    // Ensure minimum price
    finalPrice = Math.max(0.0001, finalPrice);
    
    // Round to appropriate precision
    const roundedPrice = this.roundSolarPrice(finalPrice);

    // Set price
    priceInput.value = roundedPrice;

    // Display conversion details
    kwhConversion.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>⚡ Energy Calculation:</strong>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
        <div>Estimated kWh: ${kwhValue}</div>
        <div>Base Rate: ${kwhToSolarRate} Solar/kWh</div>
        <div>Category Modifier: ${categoryMultiplier}x</div>
        <div>Value Modifier: ${valueMultiplier}x</div>
        <div style="grid-column: span 2; border-top: 1px solid #28a745; padding-top: 8px; margin-top: 8px;">
          <strong>Final Price: ${roundedPrice} Solar</strong>
        </div>
      </div>
    `;

    console.log('💰 Solar pricing calculated:', {
      kwhValue,
      baseSolarPrice,
      finalPrice: roundedPrice,
      categoryMultiplier,
      valueMultiplier
    });
  }

  getCategoryMultiplier(category) {
    const multipliers = {
      'art': 1.5,
      'music': 1.2,
      'video': 2.0,
      'document': 0.8,
      'software': 2.5,
      'other': 1.0
    };
    return multipliers[category?.toLowerCase()] || 1.0;
  }

  getValueMultiplier(valueScore) {
    const scoreMap = {
      'high': 1.5,
      'medium': 1.0,
      'low': 0.7
    };
    return scoreMap[valueScore?.toLowerCase()] || 1.0;
  }

  estimateKwh(data) {
    // Fallback kWh estimation based on file type and size
    const fileSize = data.file_size || 1000000; // 1MB default
    const baseKwh = fileSize / 10000000; // 10MB = 1 kWh as rough estimate
    return Math.max(0.1, Math.min(10, baseKwh)).toFixed(2);
  }

  roundSolarPrice(price) {
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(5);
    return price.toFixed(6);
  }

  async performFallbackAnalysis(file) {
    console.log('🔄 Performing fallback analysis...');
    
    return {
      what_ai_sees: `Digital ${file.type.split('/')[0]} file: ${file.name}. This appears to be a ${file.type} file with content that could be valuable for digital trading.`,
      suggested_category: this.guessCategory(file),
      confidence: 75,
      kwh_estimate: this.estimateKwh({ file_size: file.size }),
      value_score: 'medium',
      file_size: file.size,
      file_type: file.type
    };
  }

  guessCategory(file) {
    const type = file.type.toLowerCase();
    if (type.startsWith('image/')) return 'art';
    if (type.startsWith('audio/')) return 'music';
    if (type.startsWith('video/')) return 'video';
    if (type.includes('document') || type.includes('pdf') || type.includes('text')) return 'document';
    return 'other';
  }

  async switchTab(tabName) {
    this.currentTab = tabName;
    
    // Update tab visual state
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Load appropriate data based on tab
    if (tabName === 'my-listings' && this.currentUser) {
      await this.loadMyItems();
    } else if (tabName === 'all-market') {
      await this.loadArtifacts();
    }

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
    if (this.currentTab === 'my-listings' && this.currentUser) {
      filtered = filtered.filter(artifact => 
        artifact.creatorId === this.currentUser.id
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
    
    // Enhanced AI categorization display
    const categoryDisplay = this.formatCategory(artifact.category);
    const hasAICategory = categoryDisplay.includes('🤖') || categoryDisplay.includes('AI');

    card.innerHTML = `
      <div class="artifact-category ${isAICurated ? 'ai-enhanced' : ''}">${aiIcon}${categoryDisplay}</div>
      <h3 class="artifact-title">${this.escapeHtml(artifact.title)}</h3>
      <div class="artifact-price">${this.formatPrice(artifact.solar_amount_s)} Solar</div>
      <div class="artifact-kwh">${artifact.kwh_footprint || '0'} kWh footprint</div>
      
      ${isAICurated ? `
        <div class="artifact-ai-badge">
          <span class="ai-icon">🤖</span>
          <span class="ai-text">AI-Curated & Analyzed</span>
        </div>
      ` : ''}
      
      <div class="artifact-description">
        ${this.escapeHtml(artifact.description || 'No description available').substring(0, 120)}...
      </div>
      
      ${artifact.search_tags && artifact.search_tags.length > 0 ? `
        <div class="artifact-tags-container">
          <div class="ai-tags-header">🏷️ AI-Generated Tags</div>
          <div class="artifact-tags">
            ${artifact.search_tags.slice(0, 4).map(tag => 
              `<span class="tag ai-tag">${this.escapeHtml(tag)}</span>`
            ).join('')}
            ${artifact.search_tags.length > 4 ? `<span class="tag-more">+${artifact.search_tags.length - 4} more</span>` : ''}
          </div>
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
    const isOwner = this.currentUser && (artifact.creator_id === this.currentUser.id || artifact.creator_id === String(this.currentUser.userId));
    
    if (isOwner) {
      // Check if artifact is pending approval (only in My Items tab)
      if (this.currentTab === 'my-listings' && artifact.active === false) {
        return `
          <div class="pending-status">
            <span class="status-badge pending">⏳ Pending Review</span>
            <p class="status-text">Review your upload and approve it for publication to the marketplace.</p>
          </div>
          <button class="approve-btn" onclick="event.stopPropagation(); marketplace.approveArtifact('${artifact.id}')">
            ✅ Approve & Publish
          </button>
          <button class="artifact-action-btn edit" onclick="event.stopPropagation(); marketplace.editArtifact('${artifact.id}')">
            ✏️ Edit
          </button>
        `;
      } else {
        // Published artifact - normal owner actions
        return `
          <div class="published-status">
            <span class="status-badge published">✅ Published</span>
          </div>
          <button class="artifact-action-btn edit" onclick="event.stopPropagation(); marketplace.editArtifact('${artifact.id}')">
            ✏️ Edit
          </button>
          <button class="artifact-action-btn download" onclick="event.stopPropagation(); marketplace.downloadOwnArtifact('${artifact.id}')">
            📥 Download
          </button>
        `;
      }
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

  async approveArtifact(artifactId) {
    try {
      console.log(`✅ Approving artifact for publication: ${artifactId}`);

      const response = await fetch('/api/artifacts/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ artifactId })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`${data.message || 'Artifact approved successfully'}`);
        
        // Reload my items to show updated status
        await this.loadMyItems();
        this.render();
        
        console.log('✅ Artifact approved successfully');
      } else {
        throw new Error(data.error || 'Approval failed');
      }

    } catch (error) {
      console.error('Approval failed:', error);
      this.showError(`Failed to approve artifact: ${error.message}`);
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

  async downloadOwnArtifact(artifactId) {
    try {
      const artifact = this.artifacts.find(a => a.id === artifactId);
      
      if (!artifact) {
        alert('❌ Artifact not found');
        return;
      }

      // Check if artifact has a downloadable file
      if (artifact.trade_file_url || artifact.master_file_url || artifact.delivery_url) {
        const downloadUrl = artifact.trade_file_url || artifact.master_file_url || artifact.delivery_url;
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = artifact.title || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`📥 Downloaded: ${artifact.title}`);
      } else {
        alert(`📂 No downloadable file available for "${artifact.title}"\n\nThis artifact may be streaming-only or the file has not been uploaded yet.`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('❌ Download failed. Please try again.');
    }
  }

  async handleUpload(event) {
    event.preventDefault();
    
    const form = event.target;
    let submitBtn = null;
    let originalText = 'Upload Artifact';

    try {
      // Validate form element
      if (!form || !(form instanceof HTMLFormElement)) {
        throw new Error('Invalid form submission');
      }
      
      const formData = new FormData(form);

      // File validation
      const fileInput = form.querySelector('input[type="file"]');
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        throw new Error('Please select a file to upload');
      }
      
      const file = fileInput.files[0];
      
      // File size validation (100MB limit matching server)
      const maxFileSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxFileSize) {
        throw new Error(`File is too large. Maximum size is ${Math.round(maxFileSize / (1024 * 1024))}MB, but your file is ${Math.round(file.size / (1024 * 1024))}MB.`);
      }
      
      // Basic form validation
      const title = String(formData.get('title') || '').trim();
      if (!title || title.length < 3) {
        throw new Error('Please provide a title (at least 3 characters)');
      }

      // Show upload progress
      submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        originalText = submitBtn.textContent || 'Upload Artifact';
        submitBtn.textContent = '⏳ Uploading...';
        submitBtn.disabled = true;
      }

      // Add AI analysis data to the upload with validation
      if (this.lastAnalysisData && typeof this.lastAnalysisData === 'object') {
        try {
          formData.append('ai_analysis', JSON.stringify(this.lastAnalysisData));
          formData.append('what_ai_sees', String(this.lastAnalysisData.what_ai_sees || ''));
          formData.append('kwh_estimate', String(this.lastAnalysisData.kwh_estimate || '0.1'));
          formData.append('confidence_score', String(this.lastAnalysisData.confidence || 85));
          formData.append('value_score', String(this.lastAnalysisData.value_score || 'medium'));
          console.log('📊 Including TC Identity Sync analysis in upload:', this.lastAnalysisData);
        } catch (analysisError) {
          console.warn('Failed to include AI analysis data:', analysisError);
        }
      }

      // Upload with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      const response = await fetch('/api/creator/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      // Response validation
      if (!response) {
        throw new Error('No response received from server');
      }
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to upload artifacts');
        } else if (response.status === 413) {
          throw new Error('File is too large for upload');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Upload failed with status ${response.status}`);
        }
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid server response. Please try again.');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      if (data.success) {
        console.log('✅ Upload successful:', data.message || 'Success');
        
        // Show enhanced success message
        const analysisInfo = this.lastAnalysisData ? 
          `🤖 AI Analysis: ${this.lastAnalysisData.what_ai_sees?.substring(0, 100)}...` : 
          '';
        
        this.showSuccess(`🎉 Upload successful with TC Identity Sync! ${analysisInfo}\n\n${data.message}`);
        
        // Clear form and reset state
        form.reset();
        this.lastAnalysisData = null;
        
        // Hide upload sections
        const aiSection = document.getElementById('ai-analysis-section');
        const pricingSection = document.getElementById('pricing-section');
        const previewSection = document.getElementById('file-preview');
        
        if (aiSection) aiSection.style.display = 'none';
        if (pricingSection) pricingSection.style.display = 'none';
        if (previewSection) previewSection.style.display = 'none';
        
        // Reset upload area
        const uploadArea = document.querySelector('.file-upload-area .upload-placeholder');
        if (uploadArea) {
          uploadArea.innerHTML = `
            <div class="upload-icon">📁</div>
            <div class="upload-text">Click to select file or drag and drop</div>
            <div class="upload-hint">Images, videos, documents, audio files supported</div>
          `;
        }
        
        // Reload artifacts to show new upload
        await this.loadArtifacts();
        
        // Switch to all market tab to see the new item
        this.switchTab('all-market');

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
      // AI-Enhanced Categories
      'ai-tools': '🤖 AI Tools',
      'ai-automation': '⚙️ AI Automation', 
      'ai-creativity': '🎨 AI Creativity',
      'ai-analysis': '📊 AI Analysis',
      'ai-assistants': '💬 AI Assistants',
      'ai-generated': '🤖 AI Generated',
      'machine-learning': '🧠 Machine Learning',
      'computer-vision': '👁️ Computer Vision',
      
      // TC Identity Sync Categories (AI-curated)
      'productivity': '📈 Productivity',
      'utilities': '🔧 Utilities',
      'games': '🎮 Games',
      'documents': '📄 Documents',
      'code-tools': '💻 Code Tools',
      'media-tools': '🎥 Media Tools',
      'data-tools': '📁 Data Tools',
      
      // Creative & Media
      'music': '🎵 Music',
      'audio': '🎧 Audio',
      'video': '🎬 Video',
      'art': '🖼️ Art',
      'photography': '📸 Photography',
      'writing': '✍️ Writing',
      
      // Technical
      'software': '💻 Software',
      'web-development': '🌐 Web Dev',
      'mobile-apps': '📱 Mobile Apps',
      'data-science': '📊 Data Science',
      
      // Default fallback
      'other': '📦 Other',
      'document': '📄 Document'
    };
    
    return categoryMap[category] || `🏷️ ${category.charAt(0).toUpperCase() + category.slice(1)}`;
  }

  formatPrice(price) {
    const num = parseFloat(price);
    if (isNaN(num) || num == null) {
      return "0.0000"; // Return "0.0000" instead of "NaN" for invalid prices
    }
    if (num === 0) return '0.0000';
    
    // For non-zero values, ensure minimum display of 0.0001
    const roundedPrice = Math.max(0.0001, Math.round(num * 10000) / 10000);
    return roundedPrice.toFixed(4);
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
        const balance = parseFloat(result.solarBalance ?? 0);
        window.marketplace.currentUser = {
          userId: result.userId,
          username: result.username,
          firstName: result.firstName || result.name || result.username,
          email: result.email,
          solar_balance: balance  // Use underscore for consistency with UI
        };
        // IMPORTANT: Also update the separate solarBalance property that the UI uses
        window.marketplace.solarBalance = balance;
        window.marketplace.updateUserInterface();
        window.marketplace.closeSigninModal();
      }
      
      const displayBalance = parseFloat(result.solarBalance ?? 0).toFixed(4);
      alert(`🌱 Welcome back, ${result.username}! Balance: ${displayBalance} Solar`);
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
        const balance = parseFloat(result.solarBalance ?? result.initialSolarAmount ?? 0);
        window.marketplace.currentUser = {
          userId: result.userId,
          username: result.username,
          firstName: result.firstName || firstName || result.username,
          email: result.email || email,
          solar_balance: balance  // Use underscore for consistency with UI
        };
        // IMPORTANT: Also update the separate solarBalance property that the UI uses
        window.marketplace.solarBalance = balance;
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