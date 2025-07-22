/**
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
    
    console.log(`Added artifact to vault: ${artifact.name || artifact.title}`);
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
      
      console.log(`Added artifact to global market: ${artifact.name || artifact.title}`);
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
      
      console.log(`Removed artifact from global market: ${artifact.name || artifact.title}`);
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
    console.log(`Updated marketplace with ${marketplaceItems.length} items`);
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
