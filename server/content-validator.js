/**
 * Content Cross-Referencing and Validation Engine
 * Ensures TC-S Network Foundation Market claims are authentic and properly cited
 */

const MarketDataService = require('./market-data-service');

class ContentValidator {
  constructor() {
    this.marketData = new MarketDataService();
    this.validationRules = this.initializeValidationRules();
    this.citationDatabase = this.initializeCitationDatabase();
  }

  /**
   * Initialize validation rules for content authenticity
   */
  initializeValidationRules() {
    return {
      energy_claims: {
        patterns: [
          /(\d+(?:,\d+)*)\s*kWh/gi,
          /(\d+(?:\.\d+)?)\s*Solar/gi,
          /(\d+)\s*Solar\s*=\s*(\d+(?:,\d+)*)\s*kWh/gi
        ],
        validator: (match, marketData) => {
          const expectedKwh = marketData.solarStandard.value;
          if (match.includes(expectedKwh.toString())) {
            return { valid: true, confidence: 'high' };
          }
          return { 
            valid: false, 
            suggestion: `Update to current standard: 1 Solar = ${expectedKwh} kWh`,
            confidence: 'low'
          };
        }
      },

      market_size_claims: {
        patterns: [
          /(\d+(?:\.\d+)?)\s*trillion.*digital economy/gi,
          /(\d+)\s*GW.*AI.*data center/gi,
          /(\d+(?:\.\d+)?)\s*percent.*growth/gi
        ],
        validator: (match, marketData) => {
          // Validate against real market data
          const validClaims = [
            marketData.globalDigitalEconomy.value.toString(),
            marketData.aiDataCenterDemand.value.toString(),
            marketData.renewableMarketGrowth.value.toString()
          ];
          
          const isValid = validClaims.some(claim => match.includes(claim));
          return {
            valid: isValid,
            confidence: isValid ? 'high' : 'medium',
            source: isValid ? 'Verified against industry reports' : 'Needs verification'
          };
        }
      },

      date_claims: {
        patterns: [
          /since\s*(April\s*7,?\s*2025|2025-04-07)/gi,
          /launched\s*(April\s*7,?\s*2025|2025-04-07)/gi,
          /(April\s*7,?\s*2025|2025-04-07).*distribution/gi
        ],
        validator: (match, marketData) => {
          const correctDate = marketData.dailyDistribution.startDate;
          if (match.includes('April 7, 2025') || match.includes('2025-04-07')) {
            return { 
              valid: true, 
              confidence: 'high',
              note: 'Genesis date verified' 
            };
          }
          return { 
            valid: false, 
            suggestion: `Use verified genesis date: ${correctDate}`,
            confidence: 'low'
          };
        }
      },

      brand_consistency: {
        patterns: [
          /Current-See/gi,
          /The Current-See/gi,
          /TC-S Network/gi,
          /Foundation Market/gi,
          /TC-S Network Foundation/gi,
          /TC-S Network Commission/gi,
          /The Current See PBC Inc/gi
        ],
        validator: (match, marketData) => {
          if (match.toLowerCase().includes('current-see') && !match.includes('TC-S')) {
            return {
              valid: false,
              suggestion: 'Update to current brand: TC-S Network Foundation Market operated by The Current See PBC Inc.',
              confidence: 'high',
              type: 'branding'
            };
          }
          return { valid: true, confidence: 'high' };
        }
      },

      organizational_structure: {
        patterns: [
          /foundation.*protocol/gi,
          /network.*commission/gi,
          /operating.*protocol/gi,
          /steward.*solar/gi,
          /public.*benefit.*corporation/gi
        ],
        validator: (match, marketData) => {
          const validStructures = [
            'TC-S Network Foundation',
            'TC-S Network Commission', 
            'The Current See PBC Inc.',
            'solar stewardship',
            'network commissioning'
          ];
          
          const hasValidStructure = validStructures.some(structure => 
            match.toLowerCase().includes(structure.toLowerCase().split(' ')[0])
          );
          
          return {
            valid: hasValidStructure,
            confidence: hasValidStructure ? 'high' : 'medium',
            suggestion: hasValidStructure ? null : 'Include organizational structure: TC-S Network Foundation (steward) and Commission (oversight) operated by The Current See PBC Inc.'
          };
        }
      }
    };
  }

  /**
   * Initialize citation database with authoritative sources
   */
  initializeCitationDatabase() {
    return {
      renewable_energy_growth: {
        source: 'International Energy Agency (IEA)',
        title: 'Renewables 2024 – Analysis',
        url: 'https://www.iea.org/reports/renewables-2024',
        credibility: 'high',
        relevance: ['market growth', 'renewable adoption', 'industry projections']
      },

      ai_energy_demand: {
        source: 'Deloitte Insights',
        title: '2025 Renewable Energy Industry Outlook',
        url: 'https://www.deloitte.com/us/en/insights/industry/renewable-energy/renewable-energy-industry-outlook.html',
        credibility: 'high',
        relevance: ['AI data centers', '44 GW demand', 'energy requirements']
      },

      digital_economy_scale: {
        source: 'International Development Cooperation Agency (IDCA)',
        title: 'Global Digital Economy Report - 2025',
        url: 'https://www.idc-a.org/insights/qUi9XgvyrzSkyDUy9Tqr',
        credibility: 'high',
        relevance: ['16 trillion USD', 'digital economy', 'GDP percentage']
      },

      energy_marketplace_leaders: {
        source: 'LevelTen Energy',
        title: 'World\'s Largest Renewable PPA Marketplace',
        url: 'https://www.leveltenenergy.com/platform/energy-marketplace',
        credibility: 'high',
        relevance: ['renewable marketplace', 'corporate PPAs', 'market comparison']
      },

      sustainable_ubi_research: {
        source: 'United Nations',
        title: 'Rethinking Universal Basic Income: Economic Productivity, Quality of Life and the Sustainable Development Goals',
        url: 'https://www.un.org/en/un-chronicle/rethinking-universal-basic-income-economic-productivity-quality-life-and-sustainable',
        credibility: 'high',
        relevance: ['universal basic income', 'sustainability', 'economic development']
      },

      creator_economy_trends: {
        source: 'TechGenyz',
        title: 'Creator Economy Revolution 2025: Unlocking Sustainable Growth and Opportunities',
        url: 'https://techgenyz.com/creator-economy-2025-growth-challenges-future/',
        credibility: 'medium',
        relevance: ['creator economy', '2025 trends', 'digital content monetization']
      },

      tc_s_network_foundation: {
        source: 'The Current See PBC Inc.',
        title: 'TC-S Network Foundation Operating Protocols',
        url: 'https://www.thecurrentsee.org',
        credibility: 'high',
        relevance: ['foundation protocols', 'solar stewardship', 'network commissioning', 'operating procedures'],
        description: 'Official foundation governance and operating protocols'
      },

      tc_s_network_commission: {
        source: 'The Current See PBC Inc.',
        title: 'TC-S Network Commission Oversight Framework',
        url: 'https://www.thecurrentsee.org',
        credibility: 'high',
        relevance: ['network commission', 'oversight framework', 'private network deployment', 'regulatory structure'],
        description: 'Commission structure for network governance and private network commissioning'
      },

      public_benefit_corporation: {
        source: 'Legal Information Institute, Cornell Law School',
        title: 'Public Benefit Corporation Overview',
        url: 'https://www.law.cornell.edu/wex/corporation',
        credibility: 'high',
        relevance: ['public benefit corporation', 'corporate structure', 'legal framework', 'public benefit'],
        description: 'Legal framework for public benefit corporations balancing profit and public interest'
      },

      renewable_energy_governance: {
        source: 'International Renewable Energy Agency (IRENA)',
        title: 'Governance and Policy Framework for Renewable Energy',
        url: 'https://www.irena.org/publications/2022/May/Governance-and-policy-framework-for-renewable-energy',
        credibility: 'high',
        relevance: ['renewable energy governance', 'policy framework', 'energy stewardship', 'regulatory oversight'],
        description: 'International standards for renewable energy governance and stewardship'
      }
    };
  }

  /**
   * Validate content against market data and add cross-references
   */
  async validateAndEnhanceContent(content, contentType = 'general') {
    const marketData = await this.marketData.getRenewableEnergyStats();
    const validation = {
      originalContent: content,
      enhancedContent: content,
      validationResults: [],
      citations: [],
      suggestions: [],
      authenticityScore: 0,
      crossReferences: []
    };

    // Run validation rules
    for (const [ruleName, rule] of Object.entries(this.validationRules)) {
      for (const pattern of rule.patterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const result = rule.validator(match, marketData);
            validation.validationResults.push({
              rule: ruleName,
              match: match,
              ...result
            });

            // Add suggestions for improvements
            if (!result.valid && result.suggestion) {
              validation.suggestions.push({
                type: ruleName,
                original: match,
                suggested: result.suggestion,
                confidence: result.confidence
              });
            }
          }
        }
      }
    }

    // Add appropriate citations
    validation.citations = this.generateCitations(content, contentType);
    
    // Add cross-references to establish authenticity
    validation.crossReferences = this.generateCrossReferences(content, marketData);
    
    // Calculate authenticity score
    validation.authenticityScore = this.calculateAuthenticityScore(validation);
    
    // Generate enhanced content with citations
    validation.enhancedContent = this.addCitationsToContent(content, validation.citations);

    return validation;
  }

  /**
   * Generate relevant citations for content
   */
  generateCitations(content, contentType) {
    const citations = [];
    
    // Check content for citation opportunities
    if (content.toLowerCase().includes('44 gw') || content.toLowerCase().includes('ai data center')) {
      citations.push(this.citationDatabase.ai_energy_demand);
    }
    
    if (content.toLowerCase().includes('16 trillion') || content.toLowerCase().includes('digital economy')) {
      citations.push(this.citationDatabase.digital_economy_scale);
    }
    
    if (content.toLowerCase().includes('renewable') && content.toLowerCase().includes('growth')) {
      citations.push(this.citationDatabase.renewable_energy_growth);
    }
    
    if (content.toLowerCase().includes('basic income') || content.toLowerCase().includes('ubi')) {
      citations.push(this.citationDatabase.sustainable_ubi_research);
    }
    
    if (content.toLowerCase().includes('creator economy') || content.toLowerCase().includes('creator')) {
      citations.push(this.citationDatabase.creator_economy_trends);
    }

    // Always include marketplace comparison for context
    if (contentType === 'marketplace' || content.toLowerCase().includes('marketplace')) {
      citations.push(this.citationDatabase.energy_marketplace_leaders);
    }

    return citations;
  }

  /**
   * Generate cross-references to establish market position
   */
  generateCrossReferences(content, marketData) {
    const crossRefs = [];

    // Market positioning cross-references
    crossRefs.push({
      type: 'market_validation',
      claim: 'AI energy demand driving renewable growth',
      reference: `${marketData.aiDataCenterDemand.value}GW additional demand by 2030 (Deloitte 2025)`,
      relevance: 'Validates energy scarcity that TC-S Network addresses'
    });

    crossRefs.push({
      type: 'economic_scale',
      claim: 'Digital economy transformation',
      reference: `$${marketData.globalDigitalEconomy.value} trillion digital economy (15% of global GDP)`,
      relevance: 'Shows market size for digital asset trading platforms'
    });

    crossRefs.push({
      type: 'innovation_gap',
      claim: 'Individual access to renewable markets',
      reference: 'LevelTen Energy serves corporate PPAs, RenewaFi serves institutional trading',
      relevance: 'TC-S Network is first platform serving individual creators'
    });

    crossRefs.push({
      type: 'sustainability_validation',
      claim: 'Universal Basic Income through renewable energy',
      reference: 'UN recognizes UBI as pathway to sustainable development goals',
      relevance: 'Academic validation of energy-backed income distribution'
    });

    return crossRefs;
  }

  /**
   * Calculate content authenticity score
   */
  calculateAuthenticityScore(validation) {
    let score = 0;
    let total = 0;

    validation.validationResults.forEach(result => {
      total++;
      if (result.valid) {
        switch (result.confidence) {
          case 'high': score += 1; break;
          case 'medium': score += 0.7; break;
          case 'low': score += 0.3; break;
        }
      }
    });

    // Add points for citations
    score += validation.citations.length * 0.1;
    
    // Add points for cross-references
    score += validation.crossReferences.length * 0.1;

    return Math.min(Math.round((score / Math.max(total, 1)) * 100), 100);
  }

  /**
   * Add citations to content automatically
   */
  addCitationsToContent(content, citations) {
    let enhancedContent = content;
    
    citations.forEach((citation, index) => {
      const citationMark = `[${index + 1}]`;
      const citationText = `\n\n[${index + 1}] ${citation.title} - ${citation.source} (${citation.url})`;
      
      // Add citation mark to relevant text
      citation.relevance.forEach(relevantTerm => {
        const regex = new RegExp(`(${relevantTerm})`, 'gi');
        enhancedContent = enhancedContent.replace(regex, `$1${citationMark}`);
      });
      
      // Add full citation at the end
      if (!enhancedContent.includes(citationText)) {
        enhancedContent += citationText;
      }
    });

    return enhancedContent;
  }

  /**
   * Get competitor analysis for market positioning
   */
  async getCompetitorAnalysis() {
    const marketData = await this.marketData.getRenewableEnergyStats();
    
    return {
      directCompetitors: {
        levelTenEnergy: {
          strength: 'Largest renewable PPA marketplace',
          weakness: 'Corporate-only focus',
          opportunity: 'TC-S Network serves individual creators'
        },
        renewafi: {
          strength: 'Price transparency in energy trading',
          weakness: 'Institutional trading only',
          opportunity: 'TC-S Network provides consumer access'
        }
      },
      
      marketGaps: {
        individual_access: 'No platform gives individuals direct renewable energy market access',
        creator_monetization: 'No energy-backed creator economy platforms exist',
        universal_distribution: 'No renewable energy universal basic income systems'
      },
      
      competitiveAdvantages: {
        energy_backing: `Real energy backing: 1 Solar = ${marketData.solarStandard.value} kWh`,
        universal_access: 'Global Basic Income through renewable energy monetization',
        creator_focus: 'AI-powered content pricing with energy-backed payments',
        market_timing: `Aligned with ${marketData.aiDataCenterDemand.value}GW AI energy demand surge`
      }
    };
  }
}

module.exports = ContentValidator;