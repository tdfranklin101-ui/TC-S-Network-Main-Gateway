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
      // SINGLE SOURCE SESSION LOADING
      // Wait for inline script's session promise instead of fetching ourselves
      // This prevents the race condition where both scripts fetch /api/session
      if (window.sessionLoadPromise) {
        console.log('👤 MarketplaceApp: Waiting for inline script session...');
        const result = await window.sessionLoadPromise;
        
        if (window.currentUser) {
          this.currentUser = window.currentUser;
          this.solarBalance = window.currentUser.solarBalance || 0;
          console.log(`👤 MarketplaceApp: Synced from inline session: ${this.currentUser.username} (${this.solarBalance} Solar)`);
          this.updateUserInterface();
          return;
        } else {
          console.log('👤 MarketplaceApp: Inline session loaded - no user authenticated');
          this.currentUser = null;
          this.solarBalance = 0;
          this.updateUserInterface();
          return;
        }
      }
      
      // Fallback: If inline script's promise isn't available, check localStorage
      const cachedUser = localStorage.getItem('tc_s_user');
      if (cachedUser) {
        try {
          const cached = JSON.parse(cachedUser);
          this.currentUser = cached;
          this.solarBalance = cached.solarBalance || 0;
          console.log(`👤 MarketplaceApp: Using cached session: ${this.currentUser.username} (${this.solarBalance} Solar)`);
          this.updateUserInterface();
          return;
        } catch (e) {
          // Continue with fresh fetch only as last resort
        }
      }
      
      // LAST RESORT: Fetch session ourselves (should rarely happen)
      console.warn('⚠️ MarketplaceApp: Falling back to independent session fetch');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('/api/session', {
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
          console.warn('Invalid session response structure');
          return;
        }
        
        if (data.success && data.authenticated && data.user && typeof data.user === 'object') {
          this.currentUser = {
            ...data.user,
            id: data.user.id || null,
            username: data.user.username || 'Unknown User',
            solarBalance: parseFloat(data.solarBalance) || 0
          };
          this.userProfile = data.userProfile || null;
          this.solarBalance = parseFloat(data.solarBalance) || 0;
          
          // Sync with global currentUser if it exists
          if (typeof window.currentUser !== 'undefined') {
            window.currentUser = this.currentUser;
          }
          
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
              delivery_mode: String(artifact.delivery_mode || artifact.deliveryMode || 'download').toLowerCase(),
              creator_id: String(artifact.creator_id || artifact.creatorId || 'unknown'),
              created_at: artifact.created_at || artifact.dateAdded || new Date().toISOString(),
              file_type: String(artifact.file_type || artifact.fileType || 'application/octet-stream').toLowerCase(),
              active: Boolean(artifact.active !== false), // Default to true unless explicitly false
              status: String(artifact.status || 'approved').toLowerCase(),
              search_tags: Array.isArray(artifact.search_tags || artifact.searchTags) ? (artifact.search_tags || artifact.searchTags) : [],
              preview_file_url: String(artifact.preview_file_url || artifact.previewFileUrl || '').trim(),
              cover_art_url: String(artifact.cover_art_url || artifact.coverArt || artifact.coverArtUrl || '').trim(),
              preview_type: String(artifact.preview_type || artifact.previewType || '').trim(),
              streamingUrl: String(artifact.streaming_url || artifact.streamingUrl || '').trim(),
              contentFormat: String(artifact.content_format || artifact.contentFormat || '').trim(),
              sourceType: String(artifact.source_type || artifact.sourceType || 'human').trim(),
              hasFile: Boolean(artifact.has_file || artifact.hasFile),
              processingStatus: String(artifact.processing_status || artifact.processingStatus || 'pending').trim(),
              creatorIsAgent: Boolean(artifact.creator_is_agent || artifact.creatorIsAgent),
              creatorName: String(artifact.creator_name || artifact.creatorName || '').trim(),
              creatorUsername: String(artifact.creator_username || artifact.creatorUsername || '').trim(),
              masterFileSize: parseInt(artifact.master_file_size || artifact.masterFileSize) || 0,
              tradeFileSize: parseInt(artifact.trade_file_size || artifact.tradeFileSize) || 0,
              previewFileSize: parseInt(artifact.preview_file_size || artifact.previewFileSize) || 0,
              artifactClass: String(artifact.artifact_class || artifact.artifactClass || 'A').trim()
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
        <div class="user-menu visible">
          <div class="user-info">
            <div class="user-name">${this.currentUser.firstName || this.currentUser.username}</div>
            <div class="solar-balance" id="header-balance">${formattedBalance} Solar</div>
          </div>
          <a href="/agent.html" class="register-btn" style="display: inline-block; text-decoration: none; margin-right: 10px; background: linear-gradient(135deg, #00ffff, #00bfff);">🤖 Agent</a>
          <button class="logout-btn" onclick="marketplace.logout()">Logout</button>
        </div>
      `;
    } else {
      // Show register/login buttons for non-authenticated users
      headerActions.innerHTML = `
        <a href="/agent.html" class="register-btn" style="display: inline-block; text-decoration: none; margin-right: 10px; background: linear-gradient(135deg, #00ffff, #00bfff);">🤖 My Agent</a>
        <a href="/members.html" class="register-btn" style="display: inline-block; text-decoration: none; margin-right: 10px;">👥 Members</a>
        <button class="register-btn" id="signin-btn" onclick="showSigninModal()">Sign In</button>
        <button class="register-btn" id="register-btn" onclick="showSignupModal()">Join Network</button>
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

    const categoryIcons = {
      'art': '🎨', 'music': '🎵', 'video': '🎬', 'photo': '📸', 'writing': '✍️',
      'software': '💻', 'ai tools': '🤖', 'ai create': '🧠', 'docs': '📄',
      'games': '🎮', 'utilities': '🔧', 'energy': '⚡', 'computronium': '🔮',
      'culture': '🌍', 'rent': '🏠', 'basic needs': '🛒'
    };
    const thumbIcon = categoryIcons[artifact.category] || '📦';
    const imageUrl = artifact.cover_art_url || artifact.preview_file_url || '';
    const isImageType = artifact.file_type && artifact.file_type.startsWith('image/');
    const showImage = imageUrl && (isImageType || artifact.cover_art_url);

    card.innerHTML = `
      <div class="artifact-thumbnail">
        ${showImage
          ? `<img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(artifact.title)}" onerror="this.parentElement.innerHTML='<span class=\\'thumb-icon\\'>${thumbIcon}</span>'">`
          : `<span class="thumb-icon">${thumbIcon}</span>`}
      </div>
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
      ${artifact.sourceType === 'agent' || artifact.creatorIsAgent ? `
        <div style="display:inline-block;background:linear-gradient(135deg,#00ffff22,#0066ff22);border:1px solid #00ffff44;padding:2px 8px;border-radius:4px;font-size:10px;color:#00ffff;margin-bottom:8px;">🤖 Agent Created</div>
      ` : ''}
      ${artifact.artifactClass === 'B' ? `
        <div style="display:inline-block;background:linear-gradient(135deg,rgba(0,255,170,0.15),rgba(0,200,255,0.1));border:1px solid rgba(0,255,170,0.4);padding:2px 8px;border-radius:4px;font-size:10px;color:#00ffaa;margin-bottom:8px;margin-left:4px;">
          📦 File Delivery • ${(artifact.file_type || '').replace('digital-artifact','data').split('/').pop().toUpperCase() || 'FILE'} ${(artifact.tradeFileSize || artifact.masterFileSize) > 0 ? '• ' + marketplace.formatFileSize(artifact.tradeFileSize || artifact.masterFileSize) : ''}
        </div>
      ` : `
        <div style="display:inline-block;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);padding:2px 8px;border-radius:4px;font-size:10px;color:#FFD700;margin-bottom:8px;margin-left:4px;">⚡ Market Item</div>
      `}
      
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
      const isClassB = artifact.artifactClass === 'B';
      return `
        <button class="purchase-btn" onclick="event.stopPropagation(); marketplace.purchaseArtifact('${artifact.id}')">
          ${isClassB ? '💎 Purchase & Download' : '☀️ Acquire'} for ${this.formatPrice(artifact.solar_amount_s)} Solar
        </button>
        ${(isClassB && artifact.file_type && (artifact.file_type.startsWith('video/') || artifact.file_type.startsWith('audio/'))) || artifact.category === 'music' ? `
          <button class="preview-btn" onclick="event.stopPropagation(); marketplace.showVideoPreview('${artifact.id}')">
            ${artifact.file_type && artifact.file_type.startsWith('video/') ? '▶️ Preview Video' : '🎧 Stream Free'}
          </button>
        ` : ''}
      `;
    } else {
      return `
        <button class="purchase-btn" onclick="event.stopPropagation(); marketplace.showSignupModal()">
          🚀 Join to Purchase
        </button>
        ${artifact.category === 'music' ? `
          <button class="preview-btn" onclick="event.stopPropagation(); marketplace.showVideoPreview('${artifact.id}')">
            🎧 Stream Free
          </button>
        ` : ''}
      `;
    }
  }

  async showArtifactPreview(artifact) {
    console.log('Opening detail view for:', artifact.title);
    try {
      const response = await fetch('/api/artifacts/' + artifact.id + '/detail');
      let detail = artifact;
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.artifact) {
          detail = { ...artifact, ...data.artifact };
        }
      }
      this.showUniversalDetailModal(detail);
    } catch (error) {
      console.error('Detail fetch failed:', error);
      this.showUniversalDetailModal(artifact);
    }
  }

  async showVideoPreview(artifactId) {
    const artifact = this.artifacts.find(a => a.id === artifactId);
    if (!artifact) return;
    await this.showArtifactPreview(artifact);
  }

  showUniversalDetailModal(artifact) {
    const categoryIcons = {
      'art': '🎨', 'music': '🎵', 'video': '🎬', 'photo': '📸', 'photography': '📸',
      'writing': '✍️', 'software': '💻', 'ai tools': '🤖', 'ai create': '🧠', 'docs': '📄',
      'games': '🎮', 'utilities': '🔧', 'energy': '⚡', 'computronium': '🔮',
      'culture': '🌍', 'rent': '🏠', 'basic needs': '🛒'
    };
    const catIcon = categoryIcons[artifact.category] || '📦';
    const fileType = artifact.fileType || artifact.file_type || '';
    const contentFormat = artifact.contentFormat || artifact.content_format || '';
    const hasFile = artifact.hasFile || !!(artifact.masterFileUrl || artifact.tradeFileUrl || artifact.deliveryUrl || artifact.master_file_url || artifact.trade_file_url || artifact.delivery_url);
    const sourceType = artifact.sourceType || artifact.source_type || 'human';
    const isAgent = artifact.creatorIsAgent || sourceType === 'agent';
    const creatorDisplay = artifact.creatorName || artifact.creatorUsername || artifact.creator_id || 'Unknown';

    let previewHtml = '';
    const streamUrl = '/api/artifacts/' + artifact.id + '/stream-preview';

    if (fileType.startsWith('audio/') || artifact.category === 'music') {
      previewHtml = '<div style="margin-bottom:15px; background: rgba(0,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center;">' +
        '<div style="font-size:48px; margin-bottom:10px;">🎵</div>' +
        '<audio controls preload="none" style="width:100%;"><source src="' + this.escapeHtml(streamUrl) + '" type="audio/mpeg">Your browser does not support audio.</audio>' +
        '<div style="color:#888; font-size:11px; margin-top:8px;">🎧 Free streaming — Purchase to download</div></div>';
    } else if (fileType.startsWith('video/')) {
      previewHtml = '<div style="margin-bottom:15px;"><video controls preload="none" style="width:100%; max-height:350px; border-radius:8px;"><source src="' + this.escapeHtml(streamUrl) + '" type="' + fileType + '">Your browser does not support video.</video></div>';
    } else if (fileType.startsWith('image/') || contentFormat === 'svg') {
      const imgSrc = artifact.coverArtUrl || artifact.cover_art_url || streamUrl;
      previewHtml = '<div style="text-align:center;margin-bottom:15px;"><img src="' + this.escapeHtml(imgSrc) + '" alt="' + this.escapeHtml(artifact.title) + '" style="max-width:100%;max-height:300px;border-radius:8px;object-fit:contain;" onerror="this.parentElement.innerHTML=\'<span style=font-size:64px>' + catIcon + '</span>\'"></div>';
    } else if (contentFormat === 'js' || fileType === 'application/javascript') {
      const preview = artifact.contentPreview || '// ' + artifact.title + '\\n// JavaScript program artifact';
      previewHtml = '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:15px;margin-bottom:15px;font-family:\'Courier New\',monospace;font-size:12px;color:#0f0;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;">' + this.escapeHtml(preview) + '</div>';
    } else if (contentFormat === 'json') {
      const preview = artifact.contentPreview || '{}';
      previewHtml = '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:15px;margin-bottom:15px;font-family:\'Courier New\',monospace;font-size:12px;color:#61dafb;overflow-x:auto;max-height:200px;overflow-y:auto;white-space:pre-wrap;">' + this.escapeHtml(preview) + '</div>';
    } else if (contentFormat === 'md') {
      const preview = artifact.contentPreview || artifact.description || '';
      previewHtml = '<div style="background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:15px;margin-bottom:15px;font-size:13px;color:#ccc;overflow-y:auto;max-height:200px;white-space:pre-wrap;line-height:1.6;">' + this.escapeHtml(preview) + '</div>';
    } else if (contentFormat === 'csv') {
      const preview = artifact.contentPreview || '';
      const lines = preview.split('\\n').slice(0, 8);
      let tableHtml = '<div style="overflow-x:auto;margin-bottom:15px;"><table style="width:100%;border-collapse:collapse;font-size:11px;background:#0a0a0a;border-radius:8px;">';
      lines.forEach(function(line, i) {
        const cells = line.split(',').slice(0, 6);
        const tag = i === 0 ? 'th' : 'td';
        const style = i === 0 ? 'background:#1a1a2e;color:#00ffff;padding:8px;border:1px solid #333;' : 'padding:6px 8px;border:1px solid #222;color:#ccc;';
        tableHtml += '<tr>' + cells.map(function(c) { return '<' + tag + ' style="' + style + '">' + c.trim() + '</' + tag + '>'; }).join('') + '</tr>';
      });
      tableHtml += '</table></div>';
      if (lines.length < preview.split('\\n').length) tableHtml += '<div style="color:#888;font-size:11px;margin-bottom:10px;">Showing first 8 rows of ' + preview.split('\\n').length + '</div>';
      previewHtml = tableHtml;
    } else {
      previewHtml = '<div style="text-align:center;padding:30px 0;margin-bottom:15px;"><span style="font-size:64px;">' + catIcon + '</span></div>';
    }

    const totalSize = (artifact.masterFileSize || artifact.master_file_size || 0) + (artifact.tradeFileSize || artifact.trade_file_size || 0);
    let fileInfoHtml = '';
    if ((artifact.artifactClass || 'A') === 'B' && (hasFile || contentFormat)) {
      fileInfoHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:rgba(0,255,255,0.03);border:1px solid #1a1a2e;border-radius:8px;margin-bottom:15px;font-size:12px;">' +
        '<div style="color:#888;">Type</div><div style="color:#fff;">' + (fileType || contentFormat || 'unknown') + '</div>' +
        (totalSize > 0 ? '<div style="color:#888;">File Size</div><div style="color:#fff;">' + this.formatFileSize(totalSize) + '</div>' : '') +
        (artifact.fileDuration ? '<div style="color:#888;">Duration</div><div style="color:#fff;">' + Math.floor(artifact.fileDuration / 60) + ':' + String(artifact.fileDuration % 60).padStart(2, '0') + '</div>' : '') +
        '<div style="color:#888;">Delivery</div><div style="color:#fff;">' + (hasFile ? '📦 File Download' : '📄 Inline Content') + '</div>' +
        '</div>';
    }

    const creatorBadge = isAgent ? 
      '<span style="background:linear-gradient(135deg,#00ffff,#0066ff);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">🤖 AI Agent</span>' :
      '<span style="background:linear-gradient(135deg,#28a745,#20c997);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">👤 Human</span>';

    const classBadge = (artifact.artifactClass || 'A') === 'B' ?
      '<span style="background:linear-gradient(135deg,#00ffaa,#00ccff);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">📦 File Delivery</span>' :
      '<span style="background:rgba(255,215,0,0.2);border:1px solid rgba(255,215,0,0.4);color:#FFD700;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">⚡ Market Item</span>';

    const isOwner = this.currentUser && (artifact.creator_id === this.currentUser.id || artifact.creator_id === String(this.currentUser.userId));
    let actionButtonHtml = '';
    const artClass = artifact.artifactClass || 'A';
    if (isOwner) {
      actionButtonHtml = '<button style="background:#28a745;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;width:100%;" onclick="marketplace.downloadOwnArtifact(\'' + artifact.id + '\'); document.body.removeChild(this.closest(\'.video-preview-modal\'));">📥 Download Your Artifact</button>';
    } else if (this.currentUser) {
      if (artClass === 'B') {
        actionButtonHtml = '<button style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;width:100%;" onclick="marketplace.purchaseArtifact(\'' + artifact.id + '\'); document.body.removeChild(this.closest(\'.video-preview-modal\'));">💎 Purchase & Download for ' + this.formatPrice(artifact.solarPrice || artifact.solar_amount_s) + ' Solar</button>';
      } else {
        actionButtonHtml = '<button style="background:linear-gradient(135deg,#FFD700,#B8860B);color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;width:100%;" onclick="marketplace.purchaseArtifact(\'' + artifact.id + '\'); document.body.removeChild(this.closest(\'.video-preview-modal\'));">☀️ Acquire for ' + this.formatPrice(artifact.solarPrice || artifact.solar_amount_s) + ' Solar</button>';
      }
    } else {
      actionButtonHtml = '<button style="background:linear-gradient(135deg,#00ffff,#0066ff);color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;width:100%;" onclick="showSignupModal(); document.body.removeChild(this.closest(\'.video-preview-modal\'));">🚀 Join to Purchase</button>';
    }

    const modal = document.createElement('div');
    modal.className = 'video-preview-modal visible';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = 
      '<div style="background:#111;border:1px solid #333;border-radius:12px;max-width:650px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.8);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #222;">' +
          '<h3 style="margin:0;color:#fff;font-size:18px;">' + this.escapeHtml(artifact.title) + '</h3>' +
          '<span class="video-close-btn" style="cursor:pointer;font-size:24px;color:#888;padding:4px 8px;">&times;</span>' +
        '</div>' +
        '<div style="padding:20px;">' +
          previewHtml +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
            '<span style="font-size:16px;">' + catIcon + ' ' + this.formatCategory(artifact.category) + '</span>' +
            creatorBadge +
            classBadge +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;color:#aaa;">' +
            '<span>By: <strong style="color:#fff;">' + this.escapeHtml(creatorDisplay) + '</strong></span>' +
            (artifact.createdAt ? ' <span>• ' + new Date(artifact.createdAt).toLocaleDateString() + '</span>' : '') +
          '</div>' +
          fileInfoHtml +
          '<div style="margin-bottom:15px;">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:rgba(255,215,0,0.03);border:1px solid #2a2a1e;border-radius:8px;font-size:12px;">' +
              '<div style="color:#888;">Energy Footprint</div><div style="color:#FFD700;">⚡ ' + (artifact.kwhFootprint || artifact.kwh_footprint || 0) + ' kWh</div>' +
              '<div style="color:#888;">Solar Price</div><div style="color:#FFD700;">☀️ ' + this.formatPrice(artifact.solarPrice || artifact.solar_amount_s) + ' Solar</div>' +
            '</div>' +
          '</div>' +
          '<p style="margin:0 0 15px;line-height:1.6;color:#ccc;font-size:13px;">' + this.escapeHtml(artifact.description || 'No description available') + '</p>' +
          (artifact.searchTags && artifact.searchTags.length > 0 ? 
            '<div style="margin-bottom:15px;">' + artifact.searchTags.map(function(tag) { return '<span style="display:inline-block;background:#1a1a2e;color:#00ffff;padding:3px 10px;border-radius:12px;font-size:11px;margin:2px 4px 2px 0;">' + tag + '</span>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div style="padding:16px 20px;border-top:1px solid #222;">' +
          actionButtonHtml +
        '</div>' +
      '</div>';

    modal.querySelector('.video-close-btn').addEventListener('click', function() {
      const audio = modal.querySelector('audio');
      const video = modal.querySelector('video');
      if (audio) audio.pause();
      if (video) video.pause();
      document.body.removeChild(modal);
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        const audio = modal.querySelector('audio');
        const video = modal.querySelector('video');
        if (audio) audio.pause();
        if (video) video.pause();
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

      const isClassB = artifact.artifactClass === 'B';
      const confirmed = confirm(
        isClassB 
          ? `Purchase & Download "${artifact.title}" for ${this.formatPrice(artifact.solar_amount_s)} Solar?\n\nThis includes file delivery.`
          : `Acquire "${artifact.title}" for ${this.formatPrice(artifact.solar_amount_s)} Solar?\n\nThis is a market item (no file delivery).`
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
        console.log('Purchase successful');
        
        const purchasedArtifact = this.artifacts.find(a => a.id === artifactId);
        const purchasedClass = purchasedArtifact ? purchasedArtifact.artifactClass : 'A';

        let deliveryHtml = '';
        if (purchasedClass === 'B' && data.downloadUrl) {
          deliveryHtml = `
            <p style="margin: 15px 0; color: #ccc;">Your file is ready for download:</p>
            <a href="${data.downloadUrl}" download="${artifact.title}" 
               style="display: inline-block; background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 10px; font-size: 16px;">
              📥 Download Now
            </a>
            <p style="margin-top: 12px; font-size: 12px; color: #888;">
              Download link expires in ${data.expiresIn || '7 days'} (up to 10 downloads)
            </p>`;
        } else if (purchasedClass === 'B' && data.isTextOnly) {
          deliveryHtml = `
            <p style="margin: 15px 0; color: #ccc;">This is a text-based artifact — the content is now in your collection.</p>
            <div style="background: rgba(0,255,255,0.05); border: 1px solid #333; border-radius: 8px; padding: 12px; margin: 10px; text-align: left; font-size: 12px; color: #aaa;">
              Format: <strong style="color:#fff;">${data.contentFormat || 'text'}</strong>
            </div>`;
        } else if (purchasedClass === 'A') {
          deliveryHtml = `
            <p style="margin: 15px 0; color: #ccc;">This market item has been added to your collection.</p>
            <div style="background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.2); border-radius: 8px; padding: 12px; margin: 10px; text-align: center; font-size: 13px; color: #FFD700;">
              ⚡ Market Item — No file delivery
            </div>`;
        } else {
          deliveryHtml = `<p style="margin: 15px 0; color: #ccc;">Artifact added to your collection.</p>`;
        }

        const modal = document.createElement('div');
        modal.className = 'video-preview-modal visible';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
        modal.innerHTML = `
          <div style="background:#111;border:1px solid #333;border-radius:12px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #222;">
              <h3 style="margin:0;color:#FFD700;font-size:18px;">Purchase Successful!</h3>
              <span class="video-close-btn" style="cursor:pointer;font-size:24px;color:#888;">&times;</span>
            </div>
            <div style="padding: 20px; text-align: center;">
              <div style="font-size:48px;margin-bottom:10px;">🎉</div>
              <p style="color:#fff;font-size:16px;margin-bottom:5px;">"${this.escapeHtml(artifact.title)}"</p>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:15px 0;padding:12px;background:rgba(255,215,0,0.03);border:1px solid #2a2a1e;border-radius:8px;font-size:11px;">
                <div><div style="color:#888;">Paid</div><div style="color:#FFD700;">${this.formatPrice(data.amountPaid)} S</div></div>
                <div><div style="color:#888;">Foundation</div><div style="color:#00ffff;">${this.formatPrice(data.foundationFee)} S</div></div>
                <div><div style="color:#888;">Balance</div><div style="color:#28a745;">${this.formatPrice(data.newBalance)} S</div></div>
              </div>
              ${deliveryHtml}
              ${data.warnings && data.warnings.length > 0 ? `<div style="margin-top:10px;padding:8px;background:rgba(255,107,53,0.1);border:1px solid #ff6b35;border-radius:6px;font-size:11px;color:#ff6b35;">${data.warnings.join('<br>')}</div>` : ''}
            </div>
          </div>
        `;

        modal.querySelector('.video-close-btn').addEventListener('click', () => {
          document.body.removeChild(modal);
        });
        modal.addEventListener('click', (e) => {
          if (e.target === modal) document.body.removeChild(modal);
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
      if (artifact.tradeFileUrl || artifact.masterFileUrl || artifact.deliveryUrl || artifact.trade_file_url || artifact.master_file_url || artifact.delivery_url) {
        const downloadUrl = artifact.tradeFileUrl || artifact.masterFileUrl || artifact.deliveryUrl || artifact.trade_file_url || artifact.master_file_url || artifact.delivery_url;
        
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
  // Make marketplace globally accessible for onclick handlers and inline script sync
  window.marketplace = marketplace;
  window.marketplaceApp = marketplace; // Alias for inline script sync
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
      const balance = parseFloat(result.solarBalance ?? 0);
      
      // Create unified user object for both systems
      const userObj = {
        userId: result.userId,
        username: result.username,
        firstName: result.firstName || result.name || result.username,
        email: result.email,
        solarBalance: balance
      };
      
      // Update external marketplace class
      if (window.marketplace) {
        window.marketplace.currentUser = userObj;
        window.marketplace.solarBalance = balance;
        window.marketplace.updateUserInterface();
        window.marketplace.closeSigninModal();
      }
      
      // Also update inline script's global currentUser if it exists
      if (typeof window.currentUser !== 'undefined' || window.currentUser === null) {
        window.currentUser = userObj;
        // Also cache to localStorage for persistence
        localStorage.setItem('tc_s_user', JSON.stringify(userObj));
        // Call inline display update if available
        if (typeof window.updateUserDisplay === 'function') {
          window.updateUserDisplay();
        }
      }
      
      const displayBalance = balance.toFixed(4);
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
      const balance = parseFloat(result.solarBalance ?? result.initialSolarAmount ?? 0);
      
      // Create unified user object for both systems
      const userObj = {
        userId: result.userId,
        username: result.username,
        firstName: result.firstName || firstName || result.username,
        email: result.email || email,
        solarBalance: balance
      };
      
      // Update external marketplace class
      if (window.marketplace) {
        window.marketplace.currentUser = userObj;
        window.marketplace.solarBalance = balance;
        window.marketplace.updateUserInterface();
        window.marketplace.closeSignupModal();
      }
      
      // Also update inline script's global currentUser
      window.currentUser = userObj;
      // Cache to localStorage for persistence
      localStorage.setItem('tc_s_user', JSON.stringify(userObj));
      // Call inline display update if available
      if (typeof window.updateUserDisplay === 'function') {
        window.updateUserDisplay();
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