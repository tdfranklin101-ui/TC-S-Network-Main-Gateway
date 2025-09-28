const { OpenAI } = require('openai');

/**
 * AI Curation Service for Smart Content Analysis
 * Generates categories, descriptions, and metadata for uploaded content
 */
class AICurator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze uploaded content and generate smart description
   * Perfect for AI apps, documents, code, and other non-video content
   */
  async generateSmartDescription(fileBuffer, mimeType, metadata = {}) {
    try {
      console.log(`🤖 AI analyzing content: ${metadata.title || 'Unknown'} (${mimeType})`);
      
      // Analyze file content based on type
      let contentAnalysis = '';
      
      if (mimeType.startsWith('text/') || mimeType.includes('javascript') || mimeType.includes('python')) {
        // For code/text files, analyze actual content
        const content = fileBuffer.toString('utf8').substring(0, 4000); // First 4KB
        contentAnalysis = await this.analyzeCodeContent(content, metadata);
      } else if (mimeType === 'application/zip' || mimeType.includes('archive')) {
        // For AI apps (likely zipped), analyze based on metadata and structure
        contentAnalysis = await this.analyzeAIApplication(metadata);
      } else if (mimeType === 'application/pdf') {
        // For PDFs, analyze based on metadata
        contentAnalysis = await this.analyzePDFContent(metadata);
      } else {
        // Generic file analysis
        contentAnalysis = await this.analyzeGenericFile(mimeType, metadata);
      }

      return {
        success: true,
        previewType: 'description',
        description: contentAnalysis.description,
        category: contentAnalysis.category,
        functionality: contentAnalysis.functionality,
        suggestedPrice: contentAnalysis.suggestedPrice,
        tags: contentAnalysis.tags,
        aiGenerated: true,
        previewUrl: null, // No preview file, just descriptions
        thumbnailUrl: this.getCategoryIcon(contentAnalysis.category) // Get category icon
      };
      
    } catch (error) {
      console.error('AI curation failed:', error);
      return {
        success: false,
        error: error.message,
        previewType: 'description',
        description: metadata.description || 'Content available for download',
        category: 'uncategorized'
      };
    }
  }

  /**
   * Analyze code content for AI applications
   */
  async analyzeCodeContent(content, metadata) {
    const prompt = `
Analyze this code/application and provide a marketplace description:

Title: ${metadata.title || 'Untitled'}
User Description: ${metadata.description || 'No description provided'}

Code/Content Sample:
${content}

Please provide a JSON response with:
{
  "description": "Compelling 2-3 sentence description for marketplace buyers",
  "category": "appropriate category (ai-tools, automation, utilities, games, productivity, etc.)",
  "functionality": "What this application actually does",
  "suggestedPrice": "Price in Solar tokens (1-100 range based on complexity)",
  "tags": ["array", "of", "relevant", "tags"]
}

Focus on: What problem it solves, who would use it, and why it's valuable.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      console.warn(`AI analysis failed for code content: ${error.message}`);
      return this.getFallbackAnalysis(metadata, 'code');
    }
  }

  /**
   * Analyze AI application (typically zipped apps)
   */
  async analyzeAIApplication(metadata) {
    const prompt = `
Analyze this AI application for a marketplace:

Title: ${metadata.title || 'Untitled AI App'}
Description: ${metadata.description || 'No description provided'}
Category: ${metadata.category || 'Unknown'}

This appears to be a homemade AI application. Generate an appealing marketplace description.

Provide JSON:
{
  "description": "Compelling description highlighting AI capabilities and use cases",
  "category": "ai-tools, ai-assistants, ai-automation, ai-creativity, or ai-analysis", 
  "functionality": "What AI tasks this application performs",
  "suggestedPrice": "Solar token price (10-50 for AI apps based on sophistication)",
  "tags": ["ai", "relevant", "functionality", "tags"]
}

Emphasize practical value and AI innovation.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      console.warn(`AI analysis failed for AI app: ${error.message}`);
      return this.getFallbackAnalysis(metadata, 'ai-app');
    }
  }

  /**
   * Analyze PDF content
   */
  async analyzePDFContent(metadata) {
    const prompt = `
Create a marketplace description for this PDF:

Title: ${metadata.title || 'Document'}
Description: ${metadata.description || 'No description'}

Generate JSON:
{
  "description": "What this PDF contains and why someone would want it",
  "category": "documents, guides, research, templates, or manuals",
  "functionality": "Type of information or knowledge it provides",
  "suggestedPrice": "Solar tokens (1-20 for documents)",
  "tags": ["document", "relevant", "content", "tags"]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      console.warn(`AI analysis failed for PDF: ${error.message}`);
      return this.getFallbackAnalysis(metadata, 'document');
    }
  }

  /**
   * Analyze generic files
   */
  async analyzeGenericFile(mimeType, metadata) {
    const prompt = `
Create a marketplace description for this file:

Type: ${mimeType}
Title: ${metadata.title || 'File'}
Description: ${metadata.description || 'No description'}

Generate appealing marketplace copy in JSON:
{
  "description": "What this file is and why it's valuable",
  "category": "determine appropriate category based on file type",
  "functionality": "What the user gets from this file",
  "suggestedPrice": "Solar tokens (1-30 based on apparent value)",
  "tags": ["file", "type", "specific", "tags"]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch (error) {
      console.warn(`AI analysis failed for generic file: ${error.message}`);
      return this.getFallbackAnalysis(metadata, 'file');
    }
  }

  /**
   * Generate marketplace categories for AI apps
   */
  async generateCategories() {
    return [
      'ai-tools',      // AI utilities and assistants
      'ai-automation', // Workflow automation with AI
      'ai-creativity', // Creative AI applications
      'ai-analysis',   // Data analysis and insights
      'ai-assistants', // Personal/business assistants
      'productivity',  // General productivity tools
      'utilities',     // System utilities and tools
      'games',         // Entertainment and games
      'documents',     // PDFs, guides, templates
      'code-tools',    // Development utilities
      'media-tools',   // Audio/video processing
      'data-tools'     // Data processing applications
    ];
  }

  /**
   * Get category icon URL (no API call needed)
   */
  getCategoryIcon(category) {
    const iconMap = {
      'ai-tools': '🤖',
      'ai-automation': '⚙️', 
      'ai-creativity': '🎨',
      'ai-analysis': '📊',
      'ai-assistants': '💬',
      'productivity': '📈',
      'utilities': '🔧',
      'games': '🎮',
      'documents': '📄',
      'code-tools': '💻',
      'media-tools': '🎥',
      'data-tools': '📁',
      'uncategorized': '📦'
    };
    
    const icon = iconMap[category] || iconMap['uncategorized'];
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><text x="50%" y="50%" font-size="32" text-anchor="middle" dominant-baseline="middle">${icon}</text></svg>`;
  }

  /**
   * Fallback analysis when AI fails
   */
  getFallbackAnalysis(metadata, type) {
    const fallbacks = {
      'ai-app': {
        description: `${metadata.title || 'AI Application'} - A custom AI tool ready for download and use. ${metadata.description || 'Explore its capabilities by purchasing.'}`,
        category: 'ai-tools',
        functionality: 'AI-powered application with custom capabilities',
        suggestedPrice: '25',
        tags: ['ai', 'application', 'custom', 'tool']
      },
      'code': {
        description: `${metadata.title || 'Code Application'} - Custom software solution ready to use. ${metadata.description || 'Download to explore its functionality.'}`,
        category: 'code-tools', 
        functionality: 'Custom software application',
        suggestedPrice: '15',
        tags: ['code', 'software', 'application', 'tool']
      },
      'document': {
        description: `${metadata.title || 'Document'} - ${metadata.description || 'Valuable document content for download.'}`,
        category: 'documents',
        functionality: 'Information and knowledge resource',
        suggestedPrice: '5',
        tags: ['document', 'information', 'guide']
      },
      'file': {
        description: `${metadata.title || 'Digital Asset'} - ${metadata.description || 'Useful digital content for download.'}`,
        category: 'utilities',
        functionality: 'Digital asset or utility',
        suggestedPrice: '10',
        tags: ['digital', 'asset', 'utility']
      }
    };

    return fallbacks[type] || fallbacks['file'];
  }

  /**
   * Analyze and suggest optimal pricing based on content
   */
  async suggestPricing(contentAnalysis, fileSize, complexity = 'medium') {
    const basePrice = {
      'low': 5,
      'medium': 15, 
      'high': 35,
      'ai-premium': 50
    };

    // Adjust based on file size and type
    let multiplier = 1;
    if (fileSize > 10 * 1024 * 1024) multiplier += 0.5; // Large files
    if (contentAnalysis.category.includes('ai-')) multiplier += 0.8; // AI content premium
    
    return Math.round(basePrice[complexity] * multiplier);
  }
}

module.exports = AICurator;