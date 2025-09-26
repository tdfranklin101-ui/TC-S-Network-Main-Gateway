/**
 * TC-S Marketplace Database Service
 * Manages artifacts with real mp3/mp4 files
 */

const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.artifacts = [];
    this.users = [];
    this.transactions = [];
    this.initialized = false;
    this.init();
  }

  async init() {
    // Load real mp3 files from public/music
    const musicDir = path.join(__dirname, '../public/music');
    let musicFiles = [];
    
    try {
      if (fs.existsSync(musicDir)) {
        musicFiles = fs.readdirSync(musicDir).filter(file => 
          file.endsWith('.mp3') || file.endsWith('.mp4')
        );
      }
    } catch (error) {
      console.log('Music directory not found, using sample data');
    }

    // Create artifacts from real files
    this.artifacts = musicFiles.map((file, index) => ({
      id: `artifact_${index + 1}`,
      title: file.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
      description: `Original digital artifact: ${file}`,
      price: 100 + (index * 50),
      creatorId: "creator_tc_s",
      filePath: `/music/${file}`,
      category: file.endsWith('.mp3') ? 'audio' : 'video',
      energyKwh: 2.5 + index,
      isActive: true,
      fileSize: this.getFileSize(path.join(musicDir, file)),
      createdAt: new Date().toISOString()
    }));

    // Add sample artifacts if no real files found
    if (this.artifacts.length === 0) {
      this.artifacts = [
        {
          id: "sample_1",
          title: "Solar Harmony Demo",
          description: "Demo solar-powered audio track",
          price: 150,
          creatorId: "creator_tc_s",
          filePath: "/music/sample-track.mp3",
          category: "audio",
          energyKwh: 2.5,
          isActive: true
        }
      ];
    }

    this.users = [
      {
        id: "creator_tc_s",
        name: "TC-S Network Foundation",
        email: "marketplace@tc-s.net",
        solarBalance: 10000
      }
    ];

    this.initialized = true;
    console.log(`📊 Marketplace Database initialized with ${this.artifacts.length} artifacts`);
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  async healthCheck() {
    return {
      status: this.initialized ? 'healthy' : 'initializing',
      artifactsCount: this.artifacts.length,
      usersCount: this.users.length,
      transactionsCount: this.transactions.length
    };
  }

  async getArtifacts(query = {}) {
    return {
      artifacts: this.artifacts.filter(a => a.isActive),
      total: this.artifacts.length,
      featured: this.artifacts.slice(0, 3)
    };
  }

  async getArtifactById(id) {
    return this.artifacts.find(a => a.id === id);
  }

  async getMarketplaceStats() {
    return {
      totalArtifacts: this.artifacts.length,
      totalUsers: this.users.length,
      totalTransactions: this.transactions.length,
      totalValue: this.transactions.reduce((sum, t) => sum + t.amount, 0)
    };
  }

  async getUserById(id) {
    return this.users.find(u => u.id === id);
  }

  async recordTransaction(transaction) {
    transaction.id = `tx_${Date.now()}`;
    transaction.timestamp = new Date().toISOString();
    this.transactions.push(transaction);
    return transaction;
  }
}

module.exports = DatabaseService;