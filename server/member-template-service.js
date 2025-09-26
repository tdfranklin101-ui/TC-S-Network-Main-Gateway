/**
 * Member Template and Display Service for TC-S Network Foundation Market
 * Provides templates for content presentation including free streaming displays
 */

class MemberTemplateService {
  constructor(memberContentService) {
    this.memberContentService = memberContentService;
    this.templates = new Map();
    this.memberDisplays = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize default templates
   */
  initializeTemplates() {
    try {
      // Free Streaming Template
      this.templates.set('free_streaming', {
        id: 'free_streaming',
        name: 'Free Streaming Display',
        category: 'streaming',
        description: 'Professional streaming interface for free content access',
        features: ['auto_play', 'playlist_support', 'social_sharing', 'member_branding'],
        usageCount: 0,
        template: this.generateFreeStreamingTemplate()
      });

      // Member Showcase Template
      this.templates.set('member_showcase', {
        id: 'member_showcase',
        name: 'Member Content Showcase',
        category: 'portfolio',
        description: 'Professional portfolio display for member content',
        features: ['grid_layout', 'category_filtering', 'premium_highlighting', 'contact_info'],
        usageCount: 0,
        template: this.generateMemberShowcaseTemplate()
      });

      // Premium Gallery Template
      this.templates.set('premium_gallery', {
        id: 'premium_gallery',
        name: 'Premium Content Gallery',
        category: 'sales',
        description: 'Premium gallery for paid content with purchase integration',
        features: ['preview_mode', 'purchase_integration', 'price_display', 'testimonials'],
        usageCount: 0,
        template: this.generatePremiumGalleryTemplate()
      });

      // Artist Studio Template
      this.templates.set('artist_studio', {
        id: 'artist_studio',
        name: 'Artist Studio Display',
        category: 'creative',
        description: 'Creative studio layout for artists and creators',
        features: ['work_in_progress', 'commission_requests', 'artist_bio', 'collaboration'],
        usageCount: 0,
        template: this.generateArtistStudioTemplate()
      });

      // Minimal Clean Template
      this.templates.set('minimal_clean', {
        id: 'minimal_clean',
        name: 'Minimal Clean Display',
        category: 'minimal',
        description: 'Clean, minimal design focusing on content',
        features: ['minimal_ui', 'typography_focus', 'fast_loading', 'mobile_optimized'],
        usageCount: 0,
        template: this.generateMinimalCleanTemplate()
      });

      console.log(`📋 Initialized ${this.templates.size} member display templates`);
    } catch (error) {
      console.error('⚠️ Template initialization error:', error.message);
      console.error('📋 Full error details:', error);
      console.log('📋 Continuing with partial template initialization');
    }
  }

  /**
   * Generate Free Streaming Template
   */
  generateFreeStreamingTemplate() {
    return {
      html: `
        <div class="streaming-display" data-template="free_streaming">
          <div class="stream-header">
            <div class="member-info">
              <div class="member-avatar">{{memberAvatar}}</div>
              <div class="member-details">
                <h2 class="member-name">{{memberName}}</h2>
                <p class="member-tagline">{{memberTagline}}</p>
                <div class="solar-support">
                  <span class="solar-icon">☀️</span>
                  <span>Powered by Solar Energy</span>
                </div>
              </div>
            </div>
            <div class="stream-controls">
              <button class="follow-btn">Follow Creator</button>
              <button class="share-btn">Share Stream</button>
            </div>
          </div>

          <div class="content-player">
            <div class="player-container">
              <div class="current-content">
                <h3 class="content-title">{{currentTitle}}</h3>
                <div class="content-meta">
                  <span class="category">{{category}}</span>
                  <span class="duration">{{duration}}</span>
                  <span class="listeners">{{listenerCount}} listening</span>
                </div>
              </div>
              <div class="player-controls">
                <button class="prev-btn">⏮</button>
                <button class="play-pause-btn">▶️</button>
                <button class="next-btn">⏭</button>
                <div class="progress-bar">
                  <div class="progress-fill"></div>
                </div>
                <div class="volume-control">
                  <button class="volume-btn">🔊</button>
                  <input type="range" class="volume-slider" min="0" max="100" value="75">
                </div>
              </div>
            </div>
          </div>

          <div class="content-queue">
            <h4>Up Next - Free Streaming</h4>
            <div class="queue-list">
              {{#each queueItems}}
              <div class="queue-item" data-content-id="{{id}}">
                <div class="queue-thumbnail">{{thumbnail}}</div>
                <div class="queue-info">
                  <span class="queue-title">{{title}}</span>
                  <span class="queue-duration">{{duration}}</span>
                </div>
                <div class="queue-actions">
                  <button class="stream-now">Stream</button>
                  {{#if isPremium}}
                  <button class="purchase-btn">{{solarPrice}} Solar</button>
                  {{/if}}
                </div>
              </div>
              {{/each}}
            </div>
          </div>

          <div class="member-showcase">
            <h4>More from {{memberName}}</h4>
            <div class="showcase-grid">
              {{#each memberContent}}
              <div class="showcase-item">
                <div class="showcase-thumbnail">{{thumbnail}}</div>
                <h5>{{title}}</h5>
                <p class="showcase-category">{{category}}</p>
                {{#if isFree}}
                <span class="free-badge">FREE</span>
                {{else}}
                <span class="price-badge">{{solarPrice}} Solar</span>
                {{/if}}
              </div>
              {{/each}}
            </div>
          </div>

          <div class="stream-footer">
            <div class="solar-info">
              <p>🌞 This content is part of the TC-S Network renewable energy economy</p>
              <p>Every stream supports sustainable energy development</p>
            </div>
            <div class="member-links">
              <a href="/member/{{memberId}}" class="member-profile-link">View Full Profile</a>
              <a href="/marketplace" class="marketplace-link">Explore Marketplace</a>
            </div>
          </div>
        </div>
      `,
      css: `
        .streaming-display {
          max-width: 1200px;
          margin: 0 auto;
          background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
          color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .stream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 30px;
          background: rgba(26, 26, 26, 0.8);
          border-bottom: 1px solid #333;
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .member-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
        }

        .member-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .member-tagline {
          color: #888;
          margin-bottom: 10px;
        }

        .solar-support {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffaa00;
          font-size: 14px;
        }

        .content-player {
          padding: 40px 30px;
          background: linear-gradient(135deg, rgba(255, 170, 0, 0.1), rgba(0, 123, 255, 0.1));
        }

        .current-content {
          text-align: center;
          margin-bottom: 30px;
        }

        .content-title {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 15px;
        }

        .content-meta {
          display: flex;
          justify-content: center;
          gap: 20px;
          color: #ccc;
          font-size: 14px;
        }

        .player-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .player-controls button {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #ffffff;
          padding: 15px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 18px;
        }

        .player-controls button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .progress-bar {
          width: 300px;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffaa00, #ff6b00);
          width: 45%;
          transition: width 0.3s;
        }

        .content-queue {
          padding: 30px;
          background: rgba(26, 26, 26, 0.6);
        }

        .queue-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-height: 400px;
          overflow-y: auto;
        }

        .queue-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px;
          background: rgba(42, 42, 42, 0.5);
          border-radius: 8px;
          transition: all 0.3s;
        }

        .queue-item:hover {
          background: rgba(42, 42, 42, 0.8);
          transform: translateX(5px);
        }

        .member-showcase {
          padding: 30px;
          background: rgba(10, 10, 10, 0.8);
        }

        .showcase-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .showcase-item {
          background: rgba(26, 26, 26, 0.6);
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          transition: all 0.3s;
        }

        .showcase-item:hover {
          transform: translateY(-5px);
          background: rgba(26, 26, 26, 0.8);
        }

        .stream-footer {
          padding: 30px;
          background: rgba(0, 0, 0, 0.5);
          text-align: center;
          border-top: 1px solid #333;
        }

        .solar-info {
          margin-bottom: 20px;
          color: #ffaa00;
        }

        .member-links {
          display: flex;
          justify-content: center;
          gap: 20px;
        }

        .member-links a {
          color: #007bff;
          text-decoration: none;
          padding: 10px 20px;
          border: 1px solid #007bff;
          border-radius: 6px;
          transition: all 0.3s;
        }

        .member-links a:hover {
          background: #007bff;
          color: white;
        }

        @media (max-width: 768px) {
          .stream-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .content-meta {
            flex-direction: column;
            gap: 10px;
          }

          .player-controls {
            flex-direction: column;
            gap: 15px;
          }

          .progress-bar {
            width: 250px;
          }

          .member-links {
            flex-direction: column;
          }
        }
      `
    };
  }

  /**
   * Generate Member Showcase Template
   */
  generateMemberShowcaseTemplate() {
    return {
      html: `
        <div class="member-showcase-display" data-template="member_showcase">
          <div class="showcase-hero">
            <div class="hero-background"></div>
            <div class="hero-content">
              <div class="member-profile">
                <div class="profile-image">{{memberAvatar}}</div>
                <div class="profile-info">
                  <h1 class="member-name">{{memberName}}</h1>
                  <p class="member-bio">{{memberBio}}</p>
                  <div class="member-stats">
                    <div class="stat">
                      <span class="stat-number">{{contentCount}}</span>
                      <span class="stat-label">Content Items</span>
                    </div>
                    <div class="stat">
                      <span class="stat-number">{{totalViews}}</span>
                      <span class="stat-label">Total Views</span>
                    </div>
                    <div class="stat">
                      <span class="stat-number">{{memberSince}}</span>
                      <span class="stat-label">Member Since</span>
                    </div>
                  </div>
                  <div class="member-actions">
                    <button class="follow-btn">Follow</button>
                    <button class="message-btn">Message</button>
                    <button class="share-btn">Share Profile</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="content-navigation">
            <div class="nav-tabs">
              <button class="nav-tab active" data-tab="all">All Content</button>
              <button class="nav-tab" data-tab="featured">Featured</button>
              <button class="nav-tab" data-tab="music">Music</button>
              <button class="nav-tab" data-tab="art">Art</button>
              <button class="nav-tab" data-tab="documents">Documents</button>
              <button class="nav-tab" data-tab="free">Free</button>
            </div>
            <div class="content-search">
              <input type="text" placeholder="Search content..." class="search-input">
              <select class="sort-select">
                <option value="newest">Newest First</option>
                <option value="popular">Most Popular</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div class="content-grid">
            {{#each contentItems}}
            <div class="content-card" data-category="{{category}}" data-featured="{{featured}}">
              <div class="card-thumbnail">
                {{#if thumbnail}}
                <img src="{{thumbnail}}" alt="{{title}}">
                {{else}}
                <div class="placeholder-thumbnail">{{firstLetter title}}</div>
                {{/if}}
                {{#if featured}}
                <div class="featured-badge">⭐ Featured</div>
                {{/if}}
                {{#if isFree}}
                <div class="free-badge">FREE</div>
                {{/if}}
              </div>
              
              <div class="card-content">
                <h3 class="content-title">{{title}}</h3>
                <p class="content-description">{{description}}</p>
                <div class="content-meta">
                  <span class="category-tag">{{category}}</span>
                  <span class="upload-date">{{uploadDate}}</span>
                </div>
                
                <div class="content-stats">
                  <span class="views">👁 {{views}}</span>
                  <span class="downloads">⬇ {{downloads}}</span>
                  <span class="rating">⭐ {{rating}}/5</span>
                </div>

                <div class="content-pricing">
                  {{#if isFree}}
                  <span class="price-free">Free Content</span>
                  {{else}}
                  <span class="price-solar">{{solarPrice}} Solar</span>
                  <span class="price-kwh">({{kwhEquivalent}} kWh)</span>
                  {{/if}}
                </div>

                <div class="content-actions">
                  {{#if isFree}}
                  <button class="stream-btn">🎵 Stream</button>
                  {{/if}}
                  {{#if allowDownload}}
                  <button class="download-btn">⬇ Download</button>
                  {{/if}}
                  <button class="preview-btn">👁 Preview</button>
                  <button class="share-btn">📤 Share</button>
                </div>
              </div>
            </div>
            {{/each}}
          </div>

          <div class="showcase-footer">
            <div class="member-contact">
              <h4>Get in Touch</h4>
              <div class="contact-options">
                {{#if contactEmail}}
                <a href="mailto:{{contactEmail}}" class="contact-link">✉️ Email</a>
                {{/if}}
                {{#if socialLinks}}
                {{#each socialLinks}}
                <a href="{{url}}" class="contact-link">{{icon}} {{platform}}</a>
                {{/each}}
                {{/if}}
              </div>
            </div>
            
            <div class="solar-branding">
              <div class="solar-logo">☀️</div>
              <div class="solar-text">
                <p><strong>Powered by TC-S Network</strong></p>
                <p>Supporting renewable energy through digital content</p>
              </div>
            </div>
          </div>
        </div>
      `,
      css: `
        .member-showcase-display {
          max-width: 1400px;
          margin: 0 auto;
          background: #0a0a0a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .showcase-hero {
          position: relative;
          height: 400px;
          overflow: hidden;
          border-radius: 16px 16px 0 0;
        }

        .hero-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #ffaa00, #007bff, #28a745);
          opacity: 0.8;
        }

        .hero-content {
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 40px;
        }

        .member-profile {
          display: flex;
          align-items: center;
          gap: 40px;
          max-width: 800px;
        }

        .profile-image {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: bold;
          color: #0a0a0a;
          border: 4px solid rgba(255, 255, 255, 0.5);
        }

        .member-name {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 15px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }

        .member-bio {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 25px;
          opacity: 0.9;
        }

        .member-stats {
          display: flex;
          gap: 30px;
          margin-bottom: 25px;
        }

        .stat {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 24px;
          font-weight: bold;
        }

        .stat-label {
          font-size: 12px;
          opacity: 0.8;
          text-transform: uppercase;
        }

        .member-actions {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .member-actions button {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
          font-weight: 500;
        }

        .member-actions button:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        .content-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 30px 40px;
          background: rgba(26, 26, 26, 0.8);
          border-bottom: 1px solid #333;
        }

        .nav-tabs {
          display: flex;
          gap: 5px;
        }

        .nav-tab {
          background: transparent;
          color: #888;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 14px;
        }

        .nav-tab.active,
        .nav-tab:hover {
          background: #007bff;
          color: white;
        }

        .content-search {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .search-input,
        .sort-select {
          background: #2a2a2a;
          border: 1px solid #555;
          color: white;
          padding: 10px 15px;
          border-radius: 6px;
          font-size: 14px;
        }

        .search-input {
          width: 250px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 30px;
          padding: 40px;
        }

        .content-card {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s;
          border: 1px solid #333;
        }

        .content-card:hover {
          transform: translateY(-5px);
          background: rgba(26, 26, 26, 0.9);
          border-color: #555;
        }

        .card-thumbnail {
          position: relative;
          height: 200px;
          background: linear-gradient(135deg, #333, #555);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .placeholder-thumbnail {
          font-size: 48px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.5);
        }

        .featured-badge,
        .free-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .featured-badge {
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          color: white;
        }

        .free-badge {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
        }

        .card-content {
          padding: 20px;
        }

        .content-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          color: white;
        }

        .content-description {
          color: #ccc;
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 15px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .content-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .category-tag {
          background: rgba(0, 123, 255, 0.2);
          color: #007bff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .upload-date {
          color: #888;
          font-size: 12px;
        }

        .content-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          font-size: 14px;
          color: #ccc;
        }

        .content-pricing {
          margin-bottom: 20px;
          text-align: center;
        }

        .price-solar {
          font-size: 18px;
          font-weight: bold;
          color: #ffaa00;
        }

        .price-kwh {
          color: #888;
          font-size: 12px;
        }

        .price-free {
          color: #28a745;
          font-weight: bold;
        }

        .content-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .content-actions button {
          flex: 1;
          min-width: 80px;
          background: rgba(42, 42, 42, 0.8);
          color: white;
          border: 1px solid #555;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 12px;
        }

        .stream-btn:hover {
          background: #28a745;
        }

        .download-btn:hover {
          background: #007bff;
        }

        .preview-btn:hover {
          background: #6f42c1;
        }

        .share-btn:hover {
          background: #fd7e14;
        }

        .showcase-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 40px;
          background: rgba(10, 10, 10, 0.9);
          border-top: 1px solid #333;
        }

        .contact-options {
          display: flex;
          gap: 15px;
          margin-top: 15px;
        }

        .contact-link {
          color: #007bff;
          text-decoration: none;
          padding: 8px 16px;
          border: 1px solid #007bff;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.3s;
        }

        .contact-link:hover {
          background: #007bff;
          color: white;
        }

        .solar-branding {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .solar-logo {
          font-size: 48px;
        }

        .solar-text p {
          margin: 0;
          color: #ffaa00;
        }

        @media (max-width: 768px) {
          .member-profile {
            flex-direction: column;
            text-align: center;
            gap: 20px;
          }

          .content-navigation {
            flex-direction: column;
            gap: 20px;
          }

          .nav-tabs {
            flex-wrap: wrap;
            justify-content: center;
          }

          .content-search {
            flex-direction: column;
            width: 100%;
          }

          .search-input {
            width: 100%;
          }

          .content-grid {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .showcase-footer {
            flex-direction: column;
            gap: 30px;
            text-align: center;
          }
        }
      `
    };
  }

  /**
   * Generate Premium Gallery Template
   */
  generatePremiumGalleryTemplate() {
    return {
      html: `
        <div class="premium-gallery-display" data-template="premium_gallery">
          <div class="gallery-header">
            <h1 class="gallery-title">{{galleryTitle}}</h1>
            <p class="gallery-subtitle">{{gallerySubtitle}}</p>
            <div class="solar-badge">
              <span class="solar-icon">☀️</span>
              <span>Premium Solar-Backed Content</span>
            </div>
          </div>

          <div class="featured-content">
            <div class="featured-item">
              <div class="featured-media">{{featuredMedia}}</div>
              <div class="featured-info">
                <h2>{{featuredTitle}}</h2>
                <p>{{featuredDescription}}</p>
                <div class="featured-price">
                  <span class="price-solar">{{featuredPrice}} Solar</span>
                  <span class="price-usd">(~${{featuredPriceUSD}})</span>
                </div>
                <div class="featured-stats">
                  <span>⭐ {{featuredRating}}/5</span>
                  <span>⬇ {{featuredDownloads}} downloads</span>
                  <span>👁 {{featuredViews}} views</span>
                </div>
                <div class="featured-actions">
                  <button class="preview-btn">Preview</button>
                  <button class="purchase-btn">Purchase with Solar</button>
                </div>
              </div>
            </div>
          </div>

          <div class="gallery-grid">
            {{#each galleryItems}}
            <div class="gallery-item" data-tier="{{tier}}">
              <div class="item-media">
                {{#if preview}}
                <div class="preview-overlay">
                  <button class="preview-play">▶</button>
                </div>
                {{/if}}
                {{thumbnail}}
              </div>
              
              <div class="item-info">
                <h3>{{title}}</h3>
                <p class="item-description">{{description}}</p>
                
                <div class="item-tier">
                  {{#if tier == 'premium'}}
                  <span class="tier-badge premium">⭐ Premium</span>
                  {{else if tier == 'exclusive'}}
                  <span class="tier-badge exclusive">💎 Exclusive</span>
                  {{else}}
                  <span class="tier-badge standard">📄 Standard</span>
                  {{/if}}
                </div>

                <div class="item-pricing">
                  <div class="price-display">
                    <span class="solar-price">{{solarPrice}} Solar</span>
                    <span class="kwh-equivalent">{{kwhEquivalent}} kWh</span>
                  </div>
                  {{#if discount}}
                  <div class="discount-badge">{{discount}}% OFF</div>
                  {{/if}}
                </div>

                <div class="item-features">
                  {{#each features}}
                  <span class="feature-tag">{{this}}</span>
                  {{/each}}
                </div>

                <div class="item-actions">
                  <button class="quick-preview">👁 Preview</button>
                  <button class="add-to-cart">🛒 Add to Cart</button>
                  <button class="buy-now">⚡ Buy Now</button>
                </div>

                <div class="item-stats">
                  <span class="rating">⭐ {{rating}}</span>
                  <span class="sales">{{salesCount}} sold</span>
                </div>
              </div>
            </div>
            {{/each}}
          </div>

          <div class="gallery-sidebar">
            <div class="cart-summary">
              <h4>🛒 Your Cart</h4>
              <div class="cart-items">
                {{#each cartItems}}
                <div class="cart-item">
                  <span class="cart-title">{{title}}</span>
                  <span class="cart-price">{{price}} Solar</span>
                </div>
                {{/each}}
              </div>
              <div class="cart-total">
                <strong>Total: {{cartTotal}} Solar</strong>
              </div>
              <button class="checkout-btn">Checkout with Solar</button>
            </div>

            <div class="member-testimonials">
              <h4>💬 What Members Say</h4>
              {{#each testimonials}}
              <div class="testimonial">
                <p>"{{text}}"</p>
                <cite>- {{author}}</cite>
                <div class="testimonial-rating">
                  {{#repeat rating}}⭐{{/repeat}}
                </div>
              </div>
              {{/each}}
            </div>

            <div class="solar-benefits">
              <h4>☀️ Solar Benefits</h4>
              <ul>
                <li>✅ 100% renewable energy backed</li>
                <li>✅ Support sustainable creators</li>
                <li>✅ Carbon-negative transactions</li>
                <li>✅ Universal basic income contribution</li>
              </ul>
            </div>
          </div>
        </div>
      `,
      css: `
        .premium-gallery-display {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 30px;
          max-width: 1600px;
          margin: 0 auto;
          padding: 20px;
          background: #0a0a0a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .gallery-content {
          min-height: 100vh;
        }

        .gallery-header {
          text-align: center;
          padding: 40px 0;
          background: linear-gradient(135deg, rgba(255, 170, 0, 0.1), rgba(0, 123, 255, 0.1));
          border-radius: 16px;
          margin-bottom: 40px;
        }

        .gallery-title {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 15px;
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gallery-subtitle {
          font-size: 18px;
          color: #ccc;
          margin-bottom: 20px;
        }

        .solar-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 170, 0, 0.2);
          color: #ffaa00;
          padding: 10px 20px;
          border-radius: 25px;
          font-weight: 500;
        }

        .featured-content {
          margin-bottom: 50px;
        }

        .featured-item {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          background: rgba(26, 26, 26, 0.8);
          border-radius: 16px;
          padding: 30px;
          border: 2px solid #ffaa00;
        }

        .featured-media {
          background: linear-gradient(135deg, #333, #555);
          border-radius: 12px;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
        }

        .featured-info h2 {
          font-size: 28px;
          margin-bottom: 15px;
        }

        .featured-price {
          margin: 20px 0;
        }

        .price-solar {
          font-size: 24px;
          font-weight: bold;
          color: #ffaa00;
        }

        .price-usd {
          color: #888;
          font-size: 14px;
          margin-left: 10px;
        }

        .featured-stats {
          display: flex;
          gap: 20px;
          margin: 20px 0;
          color: #ccc;
          font-size: 14px;
        }

        .featured-actions {
          display: flex;
          gap: 15px;
        }

        .featured-actions button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
        }

        .preview-btn {
          background: rgba(108, 117, 125, 0.2);
          color: white;
          border: 1px solid #6c757d;
        }

        .purchase-btn {
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          color: white;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 30px;
        }

        .gallery-item {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s;
          border: 1px solid #333;
        }

        .gallery-item:hover {
          transform: translateY(-5px);
          border-color: #555;
        }

        .gallery-item[data-tier="exclusive"] {
          border-color: #e83e8c;
          background: rgba(232, 62, 140, 0.05);
        }

        .gallery-item[data-tier="premium"] {
          border-color: #ffaa00;
          background: rgba(255, 170, 0, 0.05);
        }

        .item-media {
          position: relative;
          height: 200px;
          background: linear-gradient(135deg, #333, #555);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .preview-play {
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .preview-play:hover {
          background: white;
          transform: scale(1.1);
        }

        .item-info {
          padding: 20px;
        }

        .item-info h3 {
          font-size: 18px;
          margin-bottom: 10px;
        }

        .item-description {
          color: #ccc;
          font-size: 14px;
          margin-bottom: 15px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tier-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 15px;
          display: inline-block;
        }

        .tier-badge.premium {
          background: rgba(255, 170, 0, 0.2);
          color: #ffaa00;
        }

        .tier-badge.exclusive {
          background: rgba(232, 62, 140, 0.2);
          color: #e83e8c;
        }

        .tier-badge.standard {
          background: rgba(108, 117, 125, 0.2);
          color: #6c757d;
        }

        .item-pricing {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .solar-price {
          font-size: 18px;
          font-weight: bold;
          color: #ffaa00;
        }

        .kwh-equivalent {
          color: #888;
          font-size: 12px;
        }

        .discount-badge {
          background: #dc3545;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .item-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }

        .feature-tag {
          background: rgba(0, 123, 255, 0.2);
          color: #007bff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .item-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
        }

        .item-actions button {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.3s;
        }

        .quick-preview {
          background: rgba(108, 117, 125, 0.2);
          color: white;
        }

        .add-to-cart {
          background: rgba(0, 123, 255, 0.2);
          color: #007bff;
        }

        .buy-now {
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          color: white;
        }

        .item-stats {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
        }

        .gallery-sidebar {
          position: sticky;
          top: 20px;
          height: fit-content;
        }

        .cart-summary,
        .member-testimonials,
        .solar-benefits {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #333;
        }

        .cart-summary h4,
        .member-testimonials h4,
        .solar-benefits h4 {
          margin-bottom: 15px;
          color: #ffaa00;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #333;
        }

        .cart-total {
          padding: 15px 0;
          text-align: center;
          font-size: 18px;
          color: #ffaa00;
        }

        .checkout-btn {
          width: 100%;
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          color: white;
          border: none;
          padding: 15px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }

        .checkout-btn:hover {
          transform: translateY(-2px);
        }

        .testimonial {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .testimonial p {
          font-style: italic;
          margin-bottom: 10px;
        }

        .testimonial cite {
          color: #888;
          font-size: 14px;
        }

        .testimonial-rating {
          margin-top: 5px;
        }

        .solar-benefits ul {
          list-style: none;
          padding: 0;
        }

        .solar-benefits li {
          padding: 8px 0;
          color: #ccc;
        }

        @media (max-width: 1200px) {
          .premium-gallery-display {
            grid-template-columns: 1fr;
          }

          .gallery-sidebar {
            position: static;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
          }
        }

        @media (max-width: 768px) {
          .featured-item {
            grid-template-columns: 1fr;
          }

          .gallery-grid {
            grid-template-columns: 1fr;
          }

          .gallery-sidebar {
            grid-template-columns: 1fr;
          }
        }
      `
    };
  }

  /**
   * Generate Artist Studio Template
   */
  generateArtistStudioTemplate() {
    return {
      html: `
        <div class="artist-studio-display" data-template="artist_studio">
          <div class="studio-header">
            <div class="studio-branding">
              <h1 class="studio-name">{{studioName}}</h1>
              <p class="studio-tagline">{{studioTagline}}</p>
            </div>
            <div class="studio-status">
              <div class="status-indicator {{studioStatus}}"></div>
              <span>{{studioStatusText}}</span>
            </div>
          </div>

          <div class="studio-workspace">
            <div class="current-project">
              <h3>🎨 Currently Working On</h3>
              <div class="project-showcase">
                <div class="project-preview">{{currentProjectPreview}}</div>
                <div class="project-details">
                  <h4>{{currentProjectTitle}}</h4>
                  <p>{{currentProjectDescription}}</p>
                  <div class="project-progress">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: {{projectProgress}}%"></div>
                    </div>
                    <span>{{projectProgress}}% Complete</span>
                  </div>
                  <div class="project-timeline">
                    <span>Expected completion: {{expectedCompletion}}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="studio-sections">
              <div class="work-gallery">
                <h3>🖼️ Recent Works</h3>
                <div class="gallery-grid">
                  {{#each recentWorks}}
                  <div class="work-item">
                    <div class="work-thumbnail">{{thumbnail}}</div>
                    <div class="work-info">
                      <h5>{{title}}</h5>
                      <span class="work-type">{{type}}</span>
                      <div class="work-actions">
                        {{#if available}}
                        <button class="view-btn">View</button>
                        <button class="purchase-btn">{{price}} Solar</button>
                        {{else}}
                        <span class="sold-out">Sold Out</span>
                        {{/if}}
                      </div>
                    </div>
                  </div>
                  {{/each}}
                </div>
              </div>

              <div class="commission-board">
                <h3>💼 Commission Opportunities</h3>
                <div class="commission-info">
                  <div class="commission-status">
                    {{#if acceptingCommissions}}
                    <span class="status-open">✅ Open for Commissions</span>
                    {{else}}
                    <span class="status-closed">⏸️ Currently Closed</span>
                    {{/if}}
                  </div>
                  
                  {{#if acceptingCommissions}}
                  <div class="commission-types">
                    {{#each commissionTypes}}
                    <div class="commission-type">
                      <h5>{{name}}</h5>
                      <p>{{description}}</p>
                      <div class="commission-pricing">
                        <span class="base-price">From {{basePrice}} Solar</span>
                        <span class="timeline">{{estimatedDays}} days</span>
                      </div>
                    </div>
                    {{/each}}
                  </div>
                  
                  <div class="commission-form">
                    <h4>Request a Commission</h4>
                    <form class="commission-request">
                      <input type="text" placeholder="Your name" required>
                      <input type="email" placeholder="Your email" required>
                      <select required>
                        <option value="">Select commission type</option>
                        {{#each commissionTypes}}
                        <option value="{{id}}">{{name}}</option>
                        {{/each}}
                      </select>
                      <textarea placeholder="Describe your project..." rows="4" required></textarea>
                      <input type="number" placeholder="Budget in Solar" min="0" step="0.001">
                      <button type="submit" class="submit-commission">Submit Request</button>
                    </form>
                  </div>
                  {{/if}}
                </div>
              </div>

              <div class="collaboration-space">
                <h3>🤝 Collaboration</h3>
                <div class="collab-opportunities">
                  <div class="seeking-collaborations">
                    <h4>Looking to Collaborate On:</h4>
                    <div class="collab-tags">
                      {{#each seekingCollabs}}
                      <span class="collab-tag">{{this}}</span>
                      {{/each}}
                    </div>
                  </div>
                  
                  <div class="skills-offered">
                    <h4>Skills I Can Offer:</h4>
                    <div class="skill-tags">
                      {{#each skillsOffered}}
                      <span class="skill-tag">{{this}}</span>
                      {{/each}}
                    </div>
                  </div>

                  <div class="collab-contact">
                    <button class="contact-collab">Start a Collaboration</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="studio-sidebar">
            <div class="artist-profile">
              <div class="artist-avatar">{{artistAvatar}}</div>
              <h4>{{artistName}}</h4>
              <p class="artist-specialty">{{artistSpecialty}}</p>
              <div class="artist-stats">
                <div class="stat">
                  <span class="stat-number">{{yearsExperience}}</span>
                  <span class="stat-label">Years</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{completedProjects}}</span>
                  <span class="stat-label">Projects</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{happyClients}}</span>
                  <span class="stat-label">Clients</span>
                </div>
              </div>
            </div>

            <div class="tools-software">
              <h4>🛠️ Tools & Software</h4>
              <div class="tools-list">
                {{#each toolsUsed}}
                <div class="tool-item">
                  <span class="tool-icon">{{icon}}</span>
                  <span class="tool-name">{{name}}</span>
                  <span class="tool-level">{{level}}</span>
                </div>
                {{/each}}
              </div>
            </div>

            <div class="process-timeline">
              <h4>⚡ My Process</h4>
              <div class="process-steps">
                {{#each processSteps}}
                <div class="process-step">
                  <div class="step-number">{{stepNumber}}</div>
                  <div class="step-content">
                    <h5>{{title}}</h5>
                    <p>{{description}}</p>
                  </div>
                </div>
                {{/each}}
              </div>
            </div>

            <div class="testimonials">
              <h4>💬 Client Feedback</h4>
              {{#each testimonials}}
              <div class="testimonial">
                <div class="testimonial-rating">
                  {{#repeat rating}}⭐{{/repeat}}
                </div>
                <p>"{{text}}"</p>
                <cite>- {{clientName}}</cite>
              </div>
              {{/each}}
            </div>

            <div class="solar-studio">
              <h4>☀️ Solar-Powered Studio</h4>
              <p>This studio runs on renewable energy through the TC-S Network, ensuring every creative work contributes to sustainable development.</p>
              <div class="energy-stats">
                <div class="energy-stat">
                  <span class="energy-number">{{solarGenerated}}</span>
                  <span class="energy-label">kWh Generated</span>
                </div>
                <div class="energy-stat">
                  <span class="energy-number">{{carbonOffset}}</span>
                  <span class="energy-label">CO₂ Offset</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      css: `
        .artist-studio-display {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 30px;
          max-width: 1600px;
          margin: 0 auto;
          padding: 20px;
          background: #0a0a0a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .studio-header {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 30px;
          background: linear-gradient(135deg, rgba(138, 43, 226, 0.1), rgba(255, 20, 147, 0.1));
          border-radius: 16px;
          margin-bottom: 30px;
        }

        .studio-name {
          font-size: 32px;
          font-weight: bold;
          background: linear-gradient(135deg, #8a2be2, #ff1493);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .studio-tagline {
          color: #ccc;
          font-size: 16px;
          margin-top: 5px;
        }

        .studio-status {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(26, 26, 26, 0.8);
          padding: 15px 20px;
          border-radius: 25px;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-indicator.online {
          background: #28a745;
          box-shadow: 0 0 10px #28a745;
        }

        .status-indicator.busy {
          background: #ffc107;
          box-shadow: 0 0 10px #ffc107;
        }

        .status-indicator.offline {
          background: #6c757d;
        }

        .current-project {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
          border: 1px solid #8a2be2;
        }

        .project-showcase {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          margin-top: 20px;
        }

        .project-preview {
          background: linear-gradient(135deg, #333, #555);
          border-radius: 8px;
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .project-details h4 {
          font-size: 20px;
          margin-bottom: 10px;
          color: #ff1493;
        }

        .project-progress {
          margin: 15px 0;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8a2be2, #ff1493);
          transition: width 0.3s;
        }

        .studio-sections {
          display: grid;
          gap: 30px;
        }

        .work-gallery,
        .commission-board,
        .collaboration-space {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          padding: 25px;
          border: 1px solid #333;
        }

        .work-gallery h3,
        .commission-board h3,
        .collaboration-space h3 {
          color: #ff1493;
          margin-bottom: 20px;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 20px;
        }

        .work-item {
          background: rgba(42, 42, 42, 0.5);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s;
        }

        .work-item:hover {
          transform: translateY(-3px);
          background: rgba(42, 42, 42, 0.8);
        }

        .work-thumbnail {
          height: 120px;
          background: linear-gradient(135deg, #333, #555);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .work-info {
          padding: 15px;
        }

        .work-info h5 {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .work-type {
          color: #888;
          font-size: 12px;
        }

        .work-actions {
          margin-top: 10px;
          display: flex;
          gap: 8px;
        }

        .work-actions button {
          flex: 1;
          padding: 6px 10px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.3s;
        }

        .view-btn {
          background: rgba(138, 43, 226, 0.2);
          color: #8a2be2;
        }

        .purchase-btn {
          background: linear-gradient(135deg, #ffaa00, #ff6b00);
          color: white;
        }

        .sold-out {
          color: #6c757d;
          font-size: 11px;
          text-align: center;
          padding: 6px;
        }

        .commission-info {
          display: grid;
          gap: 25px;
        }

        .status-open {
          color: #28a745;
          font-weight: bold;
        }

        .status-closed {
          color: #6c757d;
          font-weight: bold;
        }

        .commission-types {
          display: grid;
          gap: 20px;
        }

        .commission-type {
          background: rgba(42, 42, 42, 0.5);
          padding: 20px;
          border-radius: 8px;
        }

        .commission-type h5 {
          color: #ff1493;
          margin-bottom: 10px;
        }

        .commission-pricing {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
          font-size: 14px;
        }

        .base-price {
          color: #ffaa00;
          font-weight: bold;
        }

        .timeline {
          color: #888;
        }

        .commission-form {
          background: rgba(42, 42, 42, 0.3);
          padding: 20px;
          border-radius: 8px;
        }

        .commission-request {
          display: grid;
          gap: 15px;
        }

        .commission-request input,
        .commission-request select,
        .commission-request textarea {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #555;
          color: white;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }

        .commission-request input:focus,
        .commission-request select:focus,
        .commission-request textarea:focus {
          outline: none;
          border-color: #ff1493;
        }

        .submit-commission {
          background: linear-gradient(135deg, #8a2be2, #ff1493);
          color: white;
          border: none;
          padding: 15px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }

        .submit-commission:hover {
          transform: translateY(-2px);
        }

        .collab-opportunities {
          display: grid;
          gap: 20px;
        }

        .collab-tags,
        .skill-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .collab-tag,
        .skill-tag {
          background: rgba(138, 43, 226, 0.2);
          color: #8a2be2;
          padding: 6px 12px;
          border-radius: 15px;
          font-size: 12px;
        }

        .skill-tag {
          background: rgba(255, 20, 147, 0.2);
          color: #ff1493;
        }

        .contact-collab {
          background: linear-gradient(135deg, #8a2be2, #ff1493);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 15px;
        }

        .studio-sidebar {
          display: grid;
          gap: 25px;
          height: fit-content;
          position: sticky;
          top: 20px;
        }

        .artist-profile,
        .tools-software,
        .process-timeline,
        .testimonials,
        .solar-studio {
          background: rgba(26, 26, 26, 0.8);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #333;
        }

        .artist-profile {
          text-align: center;
        }

        .artist-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8a2be2, #ff1493);
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
        }

        .artist-specialty {
          color: #888;
          margin-bottom: 20px;
        }

        .artist-stats {
          display: flex;
          justify-content: space-around;
        }

        .stat {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 20px;
          font-weight: bold;
          color: #ff1493;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
        }

        .tools-software h4,
        .process-timeline h4,
        .testimonials h4,
        .solar-studio h4 {
          color: #ff1493;
          margin-bottom: 15px;
        }

        .tools-list {
          display: grid;
          gap: 10px;
        }

        .tool-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          background: rgba(42, 42, 42, 0.3);
          border-radius: 6px;
        }

        .tool-level {
          margin-left: auto;
          color: #888;
          font-size: 12px;
        }

        .process-steps {
          display: grid;
          gap: 15px;
        }

        .process-step {
          display: flex;
          gap: 15px;
        }

        .step-number {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8a2be2, #ff1493);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        }

        .step-content h5 {
          margin-bottom: 5px;
        }

        .step-content p {
          color: #ccc;
          font-size: 13px;
        }

        .testimonial {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .testimonial:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .testimonial-rating {
          margin-bottom: 8px;
        }

        .testimonial p {
          font-style: italic;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .testimonial cite {
          color: #888;
          font-size: 12px;
        }

        .energy-stats {
          display: flex;
          justify-content: space-around;
          margin-top: 15px;
        }

        .energy-stat {
          text-align: center;
        }

        .energy-number {
          display: block;
          font-size: 18px;
          font-weight: bold;
          color: #ffaa00;
        }

        .energy-label {
          font-size: 11px;
          color: #888;
        }

        @media (max-width: 1200px) {
          .artist-studio-display {
            grid-template-columns: 1fr;
          }

          .studio-sidebar {
            position: static;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .studio-header {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .project-showcase {
            grid-template-columns: 1fr;
          }

          .gallery-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }

          .commission-request {
            gap: 12px;
          }

          .artist-stats {
            flex-direction: column;
            gap: 15px;
          }
        }
      `
    };
  }

  /**
   * Generate Minimal Clean Template
   */
  generateMinimalCleanTemplate() {
    return {
      html: `
        <div class="minimal-display" data-template="minimal_clean">
          <header class="minimal-header">
            <h1 class="creator-name">{{creatorName}}</h1>
            <p class="creator-focus">{{creatorFocus}}</p>
          </header>

          <main class="content-showcase">
            <div class="featured-piece">
              <div class="piece-media">{{featuredMedia}}</div>
              <div class="piece-details">
                <h2>{{featuredTitle}}</h2>
                <p class="piece-description">{{featuredDescription}}</p>
                <div class="piece-meta">
                  <span class="category">{{category}}</span>
                  <span class="date">{{createdDate}}</span>
                </div>
                {{#if featuredPrice}}
                <div class="pricing">
                  <span class="price">{{featuredPrice}} Solar</span>
                </div>
                {{/if}}
              </div>
            </div>

            <div class="content-grid">
              {{#each contentItems}}
              <article class="content-item">
                <div class="item-preview">{{preview}}</div>
                <h3>{{title}}</h3>
                <p>{{description}}</p>
                {{#if price}}
                <span class="item-price">{{price}} Solar</span>
                {{else}}
                <span class="item-free">Free</span>
                {{/if}}
              </article>
              {{/each}}
            </div>
          </main>

          <footer class="minimal-footer">
            <div class="contact-info">
              <p>{{contactText}}</p>
              {{#if email}}
              <a href="mailto:{{email}}">{{email}}</a>
              {{/if}}
            </div>
            <div class="solar-credit">
              <span>☀️ Powered by renewable energy</span>
            </div>
          </footer>
        </div>
      `,
      css: `
        .minimal-display {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
          background: #ffffff;
          color: #333333;
          font-family: 'Georgia', serif;
          line-height: 1.6;
        }

        .minimal-header {
          text-align: center;
          margin-bottom: 60px;
          padding-bottom: 40px;
          border-bottom: 1px solid #eee;
        }

        .creator-name {
          font-size: 42px;
          font-weight: 300;
          margin-bottom: 15px;
          letter-spacing: -1px;
          color: #222;
        }

        .creator-focus {
          font-size: 18px;
          color: #666;
          font-style: italic;
          margin: 0;
        }

        .featured-piece {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 80px;
          align-items: center;
        }

        .piece-media {
          background: #f8f8f8;
          border-radius: 4px;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 18px;
        }

        .piece-details h2 {
          font-size: 32px;
          font-weight: 300;
          margin-bottom: 20px;
          color: #222;
        }

        .piece-description {
          font-size: 16px;
          color: #555;
          margin-bottom: 25px;
        }

        .piece-meta {
          display: flex;
          gap: 20px;
          margin-bottom: 25px;
          font-size: 14px;
          color: #888;
        }

        .category {
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 12px;
        }

        .pricing {
          font-size: 20px;
          color: #d4a017;
          font-weight: 500;
        }

        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 40px;
          margin-bottom: 80px;
        }

        .content-item {
          text-align: center;
        }

        .item-preview {
          background: #f8f8f8;
          border-radius: 4px;
          height: 200px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          transition: all 0.3s ease;
        }

        .content-item:hover .item-preview {
          background: #f0f0f0;
        }

        .content-item h3 {
          font-size: 20px;
          font-weight: 400;
          margin-bottom: 15px;
          color: #222;
        }

        .content-item p {
          font-size: 14px;
          color: #666;
          margin-bottom: 15px;
        }

        .item-price {
          color: #d4a017;
          font-weight: 500;
        }

        .item-free {
          color: #5a9f3a;
          font-weight: 500;
        }

        .minimal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 40px;
          border-top: 1px solid #eee;
          font-size: 14px;
        }

        .contact-info a {
          color: #222;
          text-decoration: none;
          border-bottom: 1px solid #ddd;
        }

        .contact-info a:hover {
          border-bottom-color: #222;
        }

        .solar-credit {
          color: #d4a017;
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .minimal-display {
            padding: 30px 15px;
          }

          .creator-name {
            font-size: 32px;
          }

          .featured-piece {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .content-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .minimal-footer {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
        }

        @media (prefers-color-scheme: dark) {
          .minimal-display {
            background: #1a1a1a;
            color: #e0e0e0;
          }

          .creator-name,
          .piece-details h2,
          .content-item h3 {
            color: #ffffff;
          }

          .piece-media,
          .item-preview {
            background: #2a2a2a;
            color: #888;
          }

          .content-item:hover .item-preview {
            background: #333;
          }

          .minimal-header,
          .minimal-footer {
            border-color: #333;
          }

          .contact-info a {
            color: #e0e0e0;
            border-bottom-color: #555;
          }

          .contact-info a:hover {
            border-bottom-color: #e0e0e0;
          }
        }
      `
    };
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Increment usage count
    template.usageCount++;
    this.templates.set(templateId, template);
    
    return template;
  }

  /**
   * Get all available templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values()).map(template => ({
      id: template.id,
      name: template.name,
      category: template.category,
      description: template.description,
      features: template.features,
      usageCount: template.usageCount
    }));
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return Array.from(this.templates.values())
      .filter(template => template.category === category)
      .map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        features: template.features,
        usageCount: template.usageCount
      }));
  }

  /**
   * Create member display using template
   */
  async createMemberDisplay(memberId, templateId, displayData) {
    const template = this.getTemplate(templateId);
    
    const memberDisplay = {
      id: `display_${memberId}_${Date.now()}`,
      memberId: memberId,
      templateId: templateId,
      templateName: template.name,
      displayData: displayData,
      renderedHtml: this.renderTemplate(template.template.html, displayData),
      renderedCss: template.template.css,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isActive: true,
      viewCount: 0,
      customizations: {}
    };

    this.memberDisplays.set(memberDisplay.id, memberDisplay);
    console.log(`🎨 Created member display "${template.name}" for member ${memberId}`);

    return memberDisplay;
  }

  /**
   * Update member display
   */
  async updateMemberDisplay(displayId, updates) {
    const display = this.memberDisplays.get(displayId);
    if (!display) {
      throw new Error('Display not found');
    }

    const updatedDisplay = {
      ...display,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    // Re-render if data changed
    if (updates.displayData) {
      const template = this.getTemplate(display.templateId);
      updatedDisplay.renderedHtml = this.renderTemplate(template.template.html, updates.displayData);
    }

    this.memberDisplays.set(displayId, updatedDisplay);
    return updatedDisplay;
  }

  /**
   * Get member displays
   */
  getMemberDisplays(memberId) {
    return Array.from(this.memberDisplays.values())
      .filter(display => display.memberId === memberId && display.isActive)
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  /**
   * Get display by ID
   */
  getDisplayById(displayId) {
    const display = this.memberDisplays.get(displayId);
    if (!display) {
      throw new Error('Display not found');
    }

    // Increment view count
    display.viewCount++;
    this.memberDisplays.set(displayId, display);

    return display;
  }

  /**
   * Simple template rendering (in production, use a proper template engine)
   */
  renderTemplate(template, data) {
    let rendered = template;
    
    // Replace simple variables {{variable}}
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || '';
    });

    // Handle basic conditionals {{#if condition}}...{{/if}}
    rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle basic loops {{#each array}}...{{/each}}
    rendered = rendered.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, content) => {
      const array = data[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = content;
        Object.keys(item).forEach(key => {
          itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), item[key] || '');
        });
        return itemContent;
      }).join('');
    });

    return rendered;
  }

  /**
   * Get template usage statistics
   */
  getTemplateStats() {
    const templates = Array.from(this.templates.values());
    const displays = Array.from(this.memberDisplays.values());

    return {
      totalTemplates: templates.length,
      totalDisplays: displays.length,
      activeDisplays: displays.filter(d => d.isActive).length,
      mostPopularTemplate: templates.reduce((prev, curr) => 
        curr.usageCount > (prev?.usageCount || 0) ? curr : prev, null
      ),
      totalViews: displays.reduce((sum, d) => sum + d.viewCount, 0),
      templateUsage: templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        usageCount: t.usageCount,
        activeDisplays: displays.filter(d => d.templateId === t.id && d.isActive).length
      }))
    };
  }

  /**
   * Generate template preview
   */
  generateTemplatePreview(templateId, sampleData = {}) {
    try {
      const template = this.getTemplate(templateId);
      
      // Use comprehensive sample data with all required variables
      const defaultSampleData = {
        memberName: 'Sample Creator',
        memberTagline: 'Digital Artist & Creator',
        memberAvatar: '👤',
        currentTitle: 'Amazing Content',
        category: 'Art',
        galleryTitle: 'Premium Gallery',
        gallerySubtitle: 'Discover premium digital content',
        featuredTitle: 'Featured Work',
        featuredDescription: 'This is a sample featured work description.',
        featuredPrice: '5.0000',
        featuredPriceUSD: '12.50',
        featuredRating: '4.8',
        featuredDownloads: '245',
        featuredViews: '1,234',
        featuredMedia: '🖼️',
        creatorName: 'Sample Creator',
        creatorFocus: 'Digital Art & Design',
        studioName: 'Creative Studio',
        studioTagline: 'Where creativity meets technology',
        studioStatus: 'online',
        studioStatusText: 'Currently Online',
        currentProjectTitle: 'New Digital Artwork',
        currentProjectDescription: 'Working on an exciting new piece',
        projectProgress: '75',
        expectedCompletion: 'Next Week',
        currentProjectPreview: '🎨',
        contactText: 'Get in touch for collaborations',
        email: 'creator@example.com',
        acceptingCommissions: true,
        galleryItems: [],
        queueItems: [],
        memberContent: [],
        recentWorks: [],
        commissionTypes: [],
        seekingCollabs: ['Digital Art', 'Music'],
        skillsOffered: ['Illustration', 'Design'],
        toolsUsed: [],
        processSteps: [],
        testimonials: [],
        contentItems: [],
        cartItems: [],
        cartTotal: '0.0000',
        yearsExperience: '5',
        completedProjects: '127',
        happyClients: '89',
        solarGenerated: '1,250',
        carbonOffset: '845'
      };

      const previewData = { ...defaultSampleData, ...sampleData };
      
      return {
        templateId: templateId,
        templateName: template.name,
        previewHtml: this.renderTemplate(template.template.html, previewData),
        previewCss: template.template.css,
        features: template.features,
        category: template.category
      };
    } catch (error) {
      console.error(`Template preview generation error for ${templateId}:`, error);
      return {
        templateId: templateId,
        templateName: 'Error Template',
        previewHtml: '<div>Template preview unavailable</div>',
        previewCss: '',
        features: [],
        category: 'error'
      };
    }
  }
}

module.exports = MemberTemplateService;