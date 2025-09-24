/**
 * Member Content Service - Handles file sharing, advertising, and promotion for TC-S Network members
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class MemberContentService {
  constructor() {
    this.memberContent = new Map(); // In-memory storage for member content
    this.contentCategories = [
      'music',
      'art',
      'documents',
      'software',
      'videos',
      'ebooks',
      'templates',
      'courses',
      'other'
    ];
    this.initializeUploadDirectory();
  }

  async initializeUploadDirectory() {
    try {
      await fs.mkdir('./uploads/member-content', { recursive: true });
      await fs.mkdir('./uploads/member-content/images', { recursive: true });
      await fs.mkdir('./uploads/member-content/audio', { recursive: true });
      await fs.mkdir('./uploads/member-content/documents', { recursive: true });
      await fs.mkdir('./uploads/member-content/other', { recursive: true });
      console.log('📁 Member content upload directories initialized');
    } catch (error) {
      console.error('Failed to create upload directories:', error);
    }
  }

  /**
   * Upload and register member content
   */
  async uploadMemberContent(memberData, fileData, contentInfo) {
    try {
      const contentId = crypto.randomUUID();
      const uploadDate = new Date().toISOString();

      // Process content metadata
      const content = {
        id: contentId,
        memberId: memberData.userId,
        memberUsername: memberData.username,
        title: contentInfo.title,
        description: contentInfo.description,
        category: contentInfo.category,
        tags: contentInfo.tags ? contentInfo.tags.split(',').map(tag => tag.trim()) : [],
        fileName: fileData.filename,
        originalName: fileData.originalname,
        filePath: fileData.path,
        fileSize: fileData.size,
        mimeType: fileData.mimetype,
        uploadDate: uploadDate,
        
        // Pricing and promotion
        pricingSolar: parseFloat(contentInfo.pricingSolar) || 0,
        isForSale: contentInfo.isForSale === 'true',
        isFreeStreaming: contentInfo.isFreeStreaming === 'true',
        allowDownload: contentInfo.allowDownload === 'true',
        
        // Marketing features
        promotion: {
          featured: false,
          autoPromote: contentInfo.autoPromote === 'true',
          targetAudience: contentInfo.targetAudience || 'general',
          promotionBudgetSolar: parseFloat(contentInfo.promotionBudgetSolar) || 0,
          keywords: contentInfo.promotionKeywords ? contentInfo.promotionKeywords.split(',').map(k => k.trim()) : []
        },

        // Analytics
        stats: {
          views: 0,
          downloads: 0,
          streamingTime: 0,
          revenue: 0,
          likes: 0,
          shares: 0
        },

        // Status
        status: 'active',
        approvalStatus: 'pending_review', // pending_review, approved, rejected
        visibility: contentInfo.visibility || 'public' // public, members_only, private
      };

      // Store content
      this.memberContent.set(contentId, content);

      console.log(`📁 Member content uploaded: "${content.title}" by ${memberData.username}`);

      return {
        success: true,
        contentId: contentId,
        content: content
      };
    } catch (error) {
      console.error('Member content upload error:', error);
      throw error;
    }
  }

  /**
   * Get member's content listings
   */
  getMemberContent(memberId, filters = {}) {
    const memberContent = Array.from(this.memberContent.values())
      .filter(content => content.memberId === memberId);

    // Apply filters
    let filteredContent = memberContent;

    if (filters.category && filters.category !== 'all') {
      filteredContent = filteredContent.filter(content => 
        content.category === filters.category
      );
    }

    if (filters.status) {
      filteredContent = filteredContent.filter(content => 
        content.status === filters.status
      );
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredContent = filteredContent.filter(content =>
        content.title.toLowerCase().includes(searchTerm) ||
        content.description.toLowerCase().includes(searchTerm) ||
        content.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    return {
      success: true,
      content: filteredContent,
      totalCount: memberContent.length,
      filteredCount: filteredContent.length
    };
  }

  /**
   * Get marketplace content for browsing
   */
  getMarketplaceContent(filters = {}) {
    let marketplaceContent = Array.from(this.memberContent.values())
      .filter(content => 
        content.status === 'active' && 
        content.approvalStatus === 'approved' &&
        (content.visibility === 'public' || content.visibility === 'members_only')
      );

    // Apply filters
    if (filters.category && filters.category !== 'all') {
      marketplaceContent = marketplaceContent.filter(content => 
        content.category === filters.category
      );
    }

    if (filters.priceRange) {
      if (filters.priceRange === 'free') {
        marketplaceContent = marketplaceContent.filter(content => 
          content.pricingSolar === 0 || content.isFreeStreaming
        );
      } else if (filters.priceRange === 'low') {
        marketplaceContent = marketplaceContent.filter(content => 
          content.pricingSolar > 0 && content.pricingSolar <= 0.001
        );
      } else if (filters.priceRange === 'medium') {
        marketplaceContent = marketplaceContent.filter(content => 
          content.pricingSolar > 0.001 && content.pricingSolar <= 0.01
        );
      } else if (filters.priceRange === 'high') {
        marketplaceContent = marketplaceContent.filter(content => 
          content.pricingSolar > 0.01
        );
      }
    }

    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      marketplaceContent = marketplaceContent.filter(content =>
        content.title.toLowerCase().includes(searchTerm) ||
        content.description.toLowerCase().includes(searchTerm) ||
        content.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        content.memberUsername.toLowerCase().includes(searchTerm)
      );
    }

    // Sort by relevance, promotion status, upload date
    marketplaceContent.sort((a, b) => {
      // Featured content first
      if (a.promotion.featured && !b.promotion.featured) return -1;
      if (!a.promotion.featured && b.promotion.featured) return 1;
      
      // Auto-promoted content next
      if (a.promotion.autoPromote && !b.promotion.autoPromote) return -1;
      if (!a.promotion.autoPromote && b.promotion.autoPromote) return 1;
      
      // Then by upload date (newest first)
      return new Date(b.uploadDate) - new Date(a.uploadDate);
    });

    return {
      success: true,
      content: marketplaceContent,
      totalCount: marketplaceContent.length,
      categories: this.contentCategories
    };
  }

  /**
   * Update content promotion settings
   */
  updateContentPromotion(contentId, memberId, promotionData) {
    const content = this.memberContent.get(contentId);
    
    if (!content || content.memberId !== memberId) {
      throw new Error('Content not found or not owned by member');
    }

    // Update promotion settings
    content.promotion = {
      ...content.promotion,
      ...promotionData,
      lastUpdated: new Date().toISOString()
    };

    this.memberContent.set(contentId, content);

    console.log(`📢 Promotion updated for "${content.title}" by ${content.memberUsername}`);

    return {
      success: true,
      content: content
    };
  }

  /**
   * Generate advertisement for member content
   */
  generateContentAdvertisement(contentId) {
    const content = this.memberContent.get(contentId);
    
    if (!content) {
      throw new Error('Content not found');
    }

    const advertisement = {
      id: `ad_${contentId}`,
      contentId: contentId,
      title: content.title,
      memberUsername: content.memberUsername,
      category: content.category,
      description: content.description,
      tags: content.tags,
      pricingSolar: content.pricingSolar,
      isFreeStreaming: content.isFreeStreaming,
      previewUrl: content.isFreeStreaming ? `/api/content/stream/${contentId}` : null,
      downloadUrl: content.allowDownload ? `/api/content/download/${contentId}` : null,
      
      // Advertisement specific
      adType: content.pricingSolar === 0 ? 'free_content' : 'premium_content',
      callToAction: content.isFreeStreaming ? 'Stream Now' : 'Purchase & Download',
      promotionLevel: content.promotion.featured ? 'featured' : 
                     content.promotion.autoPromote ? 'promoted' : 'standard',
      
      // Targeting
      targetAudience: content.promotion.targetAudience,
      keywords: content.promotion.keywords,
      
      // Performance
      views: content.stats.views,
      downloads: content.stats.downloads,
      rating: this.calculateContentRating(content),
      
      createdAt: new Date().toISOString()
    };

    return advertisement;
  }

  /**
   * Get AI promotion recommendations for content
   */
  getAIPromotionRecommendations(contentId) {
    const content = this.memberContent.get(contentId);
    
    if (!content) {
      throw new Error('Content not found');
    }

    // AI-powered promotion recommendations
    const recommendations = {
      contentId: contentId,
      recommendations: [
        {
          type: 'keyword_optimization',
          suggestion: `Add trending keywords like "renewable energy", "solar standard", "sustainable" to increase discoverability`,
          impact: 'medium',
          effort: 'low'
        },
        {
          type: 'pricing_optimization',
          suggestion: content.pricingSolar === 0 ? 
            'Consider setting a small Solar price to increase perceived value' :
            'Your pricing is competitive for this category',
          impact: 'medium',
          effort: 'low'
        },
        {
          type: 'category_placement',
          suggestion: `Your content performs well in the "${content.category}" category`,
          impact: 'low',
          effort: 'none'
        },
        {
          type: 'cross_promotion',
          suggestion: 'Enable auto-promotion to get featured in similar content recommendations',
          impact: 'high',
          effort: 'low'
        }
      ],
      generatedAt: new Date().toISOString()
    };

    return recommendations;
  }

  /**
   * Update content statistics
   */
  updateContentStats(contentId, statType, value = 1) {
    const content = this.memberContent.get(contentId);
    
    if (!content) {
      return false;
    }

    if (content.stats[statType] !== undefined) {
      content.stats[statType] += value;
      this.memberContent.set(contentId, content);
      return true;
    }

    return false;
  }

  /**
   * Calculate content rating based on engagement
   */
  calculateContentRating(content) {
    const { views, downloads, likes, shares } = content.stats;
    
    // Simple rating calculation
    const engagementScore = (downloads * 3) + (likes * 2) + shares;
    const viewRatio = views > 0 ? engagementScore / views : 0;
    
    if (viewRatio > 0.3) return 5;
    if (viewRatio > 0.2) return 4;
    if (viewRatio > 0.1) return 3;
    if (viewRatio > 0.05) return 2;
    return 1;
  }

  /**
   * Get content for streaming
   */
  async getContentForStreaming(contentId) {
    const content = this.memberContent.get(contentId);
    
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.isFreeStreaming && !content.allowDownload) {
      throw new Error('Content not available for streaming');
    }

    // Update view stats
    this.updateContentStats(contentId, 'views');

    return {
      content: content,
      streamUrl: `/uploads/member-content/${path.basename(content.filePath)}`,
      mimeType: content.mimeType
    };
  }

  /**
   * Get member content summary for dashboard
   */
  getMemberContentSummary(memberId) {
    const memberContent = Array.from(this.memberContent.values())
      .filter(content => content.memberId === memberId);

    const summary = {
      totalContent: memberContent.length,
      activeContent: memberContent.filter(c => c.status === 'active').length,
      pendingApproval: memberContent.filter(c => c.approvalStatus === 'pending_review').length,
      totalViews: memberContent.reduce((sum, c) => sum + c.stats.views, 0),
      totalDownloads: memberContent.reduce((sum, c) => sum + c.stats.downloads, 0),
      totalRevenue: memberContent.reduce((sum, c) => sum + c.stats.revenue, 0),
      
      // Category breakdown
      categoryBreakdown: {},
      
      // Top performing content
      topContent: memberContent
        .sort((a, b) => (b.stats.views + b.stats.downloads) - (a.stats.views + a.stats.downloads))
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          title: c.title,
          category: c.category,
          views: c.stats.views,
          downloads: c.stats.downloads,
          revenue: c.stats.revenue
        }))
    };

    // Calculate category breakdown
    memberContent.forEach(content => {
      if (!summary.categoryBreakdown[content.category]) {
        summary.categoryBreakdown[content.category] = 0;
      }
      summary.categoryBreakdown[content.category]++;
    });

    return summary;
  }
}

module.exports = MemberContentService;