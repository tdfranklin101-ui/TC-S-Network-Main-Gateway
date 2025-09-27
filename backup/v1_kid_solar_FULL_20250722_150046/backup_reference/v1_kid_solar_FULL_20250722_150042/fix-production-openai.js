/**
 * Production OpenAI Connection Fix
 * 
 * This script addresses the OpenAI connection issue in the production environment
 * and implements proper marketplace artifact management.
 */

const fs = require('fs');
const path = require('path');

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✅ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Fix 1: Create a robust OpenAI service configuration for production
function createProductionOpenAIConfig() {
  const configContent = `/**
 * Production OpenAI Service Configuration
 * 
 * This configuration ensures proper OpenAI API connection in production environments.
 */

const { OpenAI } = require('openai');

class ProductionOpenAIService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.initializeClient();
  }

  initializeClient() {
    try {
      // Prioritize NEW_OPENAI_API_KEY over OPENAI_API_KEY
      const apiKey = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No OpenAI API key found in environment variables');
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        timeout: 30000, // 30 second timeout
        maxRetries: 3
      });

      this.isInitialized = true;
      console.log('OpenAI client initialized successfully in production');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error.message);
      this.isInitialized = false;
    }
  }

  async analyzeEnergyItem(itemDescription) {
    if (!this.isInitialized) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an energy analysis expert. Analyze the energy consumption of items and provide SOLAR values based on 1 SOLAR = 4,913 kWh. Return JSON with energyKwh and solarValue fields."
          },
          {
            role: "user",
            content: \`Analyze the energy consumption for: \${itemDescription}\`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        success: true,
        energyKwh: result.energyKwh || 0,
        solarValue: result.solarValue || 0,
        analysis: result.analysis || "Energy analysis completed"
      };
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw new Error('Energy analysis failed. Please ensure OpenAI service is available.');
    }
  }

  async testConnection() {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Test connection" }],
        max_tokens: 10
      });
      return response && response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('OpenAI connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new ProductionOpenAIService();
`;

  fs.writeFileSync('production-openai-service.js', configContent);
  log('Created production OpenAI service configuration');
}

// Fix 2: Create marketplace artifact management system
function createMarketplaceManagement() {
  const managementContent = `/**
 * Marketplace Artifact Management System
 * 
 * This system manages artifacts in the global marketplace, ensuring proper
 * retention and display of member items.
 */

const fs = require('fs');
const path = require('path');

class MarketplaceManager {
  constructor() {
    this.vaultPath = path.join(__dirname, 'data', 'artifact-vault.json');
    this.marketplacePath = path.join(__dirname, 'data', 'marketplace-items.json');
    this.ensureDataDirectories();
  }

  ensureDataDirectories() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  // Add artifact to vault for permanent storage
  addToVault(artifact) {
    let vault = this.loadVault();
    
    const vaultItem = {
      ...artifact,
      vaultDate: new Date().toISOString(),
      originalCreator: artifact.creator || artifact.seller,
      inGlobalMarket: false // Default to not in market
    };

    vault.push(vaultItem);
    this.saveVault(vault);
    
    console.log(\`Added artifact to vault: \${artifact.name || artifact.title}\`);
    return vaultItem;
  }

  // Mark artifact as available in global market
  addToGlobalMarket(artifactId) {
    let vault = this.loadVault();
    const artifact = vault.find(item => item.id === artifactId);
    
    if (artifact) {
      artifact.inGlobalMarket = true;
      artifact.marketListingDate = new Date().toISOString();
      this.saveVault(vault);
      this.updateMarketplace();
      
      console.log(\`Added artifact to global market: \${artifact.name || artifact.title}\`);
      return true;
    }
    
    return false;
  }

  // Remove artifact from global market (but keep in vault)
  removeFromGlobalMarket(artifactId) {
    let vault = this.loadVault();
    const artifact = vault.find(item => item.id === artifactId);
    
    if (artifact) {
      artifact.inGlobalMarket = false;
      artifact.marketRemovalDate = new Date().toISOString();
      this.saveVault(vault);
      this.updateMarketplace();
      
      console.log(\`Removed artifact from global market: \${artifact.name || artifact.title}\`);
      return true;
    }
    
    return false;
  }

  // Get all artifacts in global market
  getMarketplaceItems() {
    const vault = this.loadVault();
    return vault.filter(item => item.inGlobalMarket === true);
  }

  // Get all artifacts by a specific creator
  getArtifactsByCreator(creatorName) {
    const vault = this.loadVault();
    return vault.filter(item => 
      item.originalCreator === creatorName || 
      item.creator === creatorName ||
      item.seller === creatorName
    );
  }

  // Update marketplace file based on vault items marked for global market
  updateMarketplace() {
    const marketplaceItems = this.getMarketplaceItems();
    fs.writeFileSync(this.marketplacePath, JSON.stringify(marketplaceItems, null, 2));
    console.log(\`Updated marketplace with \${marketplaceItems.length} items\`);
  }

  // Load vault data
  loadVault() {
    if (fs.existsSync(this.vaultPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
      } catch (error) {
        console.error('Error loading vault:', error.message);
        return [];
      }
    }
    return [];
  }

  // Save vault data
  saveVault(vault) {
    try {
      fs.writeFileSync(this.vaultPath, JSON.stringify(vault, null, 2));
    } catch (error) {
      console.error('Error saving vault:', error.message);
    }
  }

  // Seed initial marketplace items if vault is empty
  seedInitialItems() {
    const vault = this.loadVault();
    
    if (vault.length === 0) {
      const initialItems = [
        {
          id: 'seed-fan-001',
          name: 'Fan',
          title: 'Fan - electric',
          description: 'Energy efficient electric fan',
          category: 'Energy & Utilities',
          creator: 'terry.franklin',
          seller: 'terry.franklin',
          energyKwh: 10410.16,
          solarValue: 3.6195,
          hasOriginalPhoto: true,
          inGlobalMarket: true,
          vaultDate: new Date().toISOString(),
          marketListingDate: new Date().toISOString(),
          originalCreator: 'terry.franklin'
        },
        {
          id: 'seed-ceiling-fan-001',
          name: 'Solar Ceiling fan',
          title: 'tropical climate ceiling hung solar powered fan',
          description: 'Solar powered ceiling fan for tropical climates',
          category: 'Creative & Entertainment',
          creator: 'terry.franklin',
          seller: 'terry.franklin',
          energyKwh: 14860.84,
          solarValue: 1.3199,
          hasOriginalPhoto: true,
          inGlobalMarket: true,
          vaultDate: new Date().toISOString(),
          marketListingDate: new Date().toISOString(),
          originalCreator: 'terry.franklin'
        }
      ];

      initialItems.forEach(item => {
        vault.push(item);
      });

      this.saveVault(vault);
      this.updateMarketplace();
      console.log('Seeded initial marketplace items');
    }
  }
}

module.exports = new MarketplaceManager();
`;

  fs.writeFileSync('marketplace-manager.js', managementContent);
  log('Created marketplace management system');
}

// Fix 3: Create deployment patch for OpenAI connection
function createDeploymentPatch() {
  const patchContent = `/**
 * Deployment Patch for OpenAI Connection Issues
 * 
 * This patch ensures proper OpenAI API connection in production deployments.
 */

// Environment variable check and setup
function validateOpenAIEnvironment() {
  const hasNewKey = !!process.env.NEW_OPENAI_API_KEY;
  const hasOldKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasNewKey && !hasOldKey) {
    console.error('❌ No OpenAI API key found in environment variables');
    console.error('Please set NEW_OPENAI_API_KEY or OPENAI_API_KEY');
    return false;
  }
  
  const keyToUse = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  console.log(\`✅ Using OpenAI API key: \${hasNewKey ? 'NEW_OPENAI_API_KEY' : 'OPENAI_API_KEY'}\`);
  console.log(\`Key length: \${keyToUse.length} characters\`);
  
  return true;
}

// Apply this patch to your main server file
if (validateOpenAIEnvironment()) {
  console.log('✅ OpenAI environment validation passed');
} else {
  console.log('❌ OpenAI environment validation failed');
}

module.exports = { validateOpenAIEnvironment };
`;

  fs.writeFileSync('openai-deployment-patch.js', patchContent);
  log('Created OpenAI deployment patch');
}

// Run all fixes
function runAllFixes() {
  log('Starting production OpenAI and marketplace fixes...');
  
  createProductionOpenAIConfig();
  createMarketplaceManagement();
  createDeploymentPatch();
  
  log('All fixes applied successfully');
  log('');
  log('Next steps:');
  log('1. Deploy the production-openai-service.js to your cross-platform mobile app');
  log('2. Replace the existing OpenAI service with the production version');
  log('3. Use marketplace-manager.js to properly manage artifacts');
  log('4. Apply openai-deployment-patch.js to validate environment variables');
  log('');
  log('The marketplace will now properly retain artifacts and manage global market status');
}

runAllFixes();