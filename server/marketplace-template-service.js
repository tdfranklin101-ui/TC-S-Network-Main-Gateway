/**
 * Simple Marketplace Template Service
 * Provides basic HTML templates for marketplace content display
 */

class MarketplaceTemplateService {
  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  initializeTemplates() {
    // Simple marketplace template
    this.templates.set('marketplace', {
      id: 'marketplace',
      name: 'Marketplace Display',
      template: this.generateMarketplaceTemplate()
    });

    console.log('📋 Marketplace template service initialized');
  }

  generateMarketplaceTemplate() {
    return {
      html: `
        <div class="marketplace-display">
          <div class="marketplace-header">
            <h1>TC-S Network Foundation Digital Artifact Marketplace</h1>
            <p>AI-curated digital artifacts with Solar-based payments</p>
          </div>
          
          <div class="artifact-grid">
            {{#each artifacts}}
            <div class="artifact-card">
              <div class="artifact-thumbnail">
                {{#if thumbnailUrl}}
                <img src="{{thumbnailUrl}}" alt="{{title}}">
                {{else}}
                <div class="placeholder-thumb">{{title}}</div>
                {{/if}}
              </div>
              
              <div class="artifact-info">
                <h3>{{title}}</h3>
                <p>{{description}}</p>
                <div class="artifact-meta">
                  <span class="category">{{category}}</span>
                  <span class="price">{{price}} Solar</span>
                </div>
                <button class="purchase-btn">Purchase</button>
              </div>
            </div>
            {{/each}}
          </div>
        </div>
      `,
      css: `
        .marketplace-display {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background: #0a0a0a;
          color: white;
          border-radius: 10px;
        }
        
        .marketplace-header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .artifact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .artifact-card {
          background: #1a1a1a;
          border-radius: 8px;
          padding: 20px;
          transition: transform 0.3s;
        }
        
        .artifact-card:hover {
          transform: translateY(-5px);
        }
        
        .purchase-btn {
          background: #ffaa00;
          color: black;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }
      `
    };
  }

  /**
   * Render template with data
   */
  renderTemplate(templateId, data) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return {
      html: template.template.html,
      css: template.template.css,
      data
    };
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return Array.from(this.templates.values()).map(template => ({
      id: template.id,
      name: template.name
    }));
  }
}

module.exports = MarketplaceTemplateService;