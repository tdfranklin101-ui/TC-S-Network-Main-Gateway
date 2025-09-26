/**
 * Database Connection and Operations
 * TC-S Network Foundation Digital Artifact Marketplace
 */

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, desc, and } = require('drizzle-orm');

// Import schemas
const { 
  marketplaceUsers, 
  artifacts, 
  transactions, 
  purchases, 
  reviews 
} = require('../shared/schema.js');

class DatabaseService {
  constructor() {
    // Use same database as Foundation app but different tables
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.sql = neon(connectionString);
    this.db = drizzle(this.sql);
    
    console.log('📊 Marketplace Database Service initialized');
  }

  // User Operations
  async createUser(userData) {
    try {
      const [user] = await this.db.insert(marketplaceUsers).values(userData).returning();
      console.log(`👤 Created marketplace user: ${user.username}`);
      return user;
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        const existingUser = await this.getUserById(userData.id);
        if (existingUser) {
          console.log(`👤 User already exists: ${existingUser.username}`);
          return existingUser;
        }
      }
      throw error;
    }
  }

  async getUserById(userId) {
    const [user] = await this.db.select().from(marketplaceUsers).where(eq(marketplaceUsers.id, userId));
    return user;
  }

  async updateUserBalance(userId, newBalance) {
    const [user] = await this.db
      .update(marketplaceUsers)
      .set({ 
        solarBalance: newBalance.toString(),
        lastActive: new Date()
      })
      .where(eq(marketplaceUsers.id, userId))
      .returning();
    
    return user;
  }

  // Artifact Operations
  async createArtifact(artifactData) {
    const [artifact] = await this.db.insert(artifacts).values(artifactData).returning();
    console.log(`🎨 Created artifact: ${artifact.title}`);
    return artifact;
  }

  async getArtifacts(filters = {}) {
    let query = this.db.select().from(artifacts).where(eq(artifacts.isActive, true));
    
    if (filters.category) {
      query = query.where(eq(artifacts.category, filters.category));
    }
    
    if (filters.featured) {
      query = query.where(eq(artifacts.isFeatured, true));
    }
    
    return await query.orderBy(desc(artifacts.createdAt));
  }

  async getArtifactById(artifactId) {
    const [artifact] = await this.db.select().from(artifacts).where(eq(artifacts.id, artifactId));
    return artifact;
  }

  // Transaction Operations
  async createTransaction(transactionData) {
    const [transaction] = await this.db.insert(transactions).values(transactionData).returning();
    console.log(`💰 Created transaction: ${transaction.type} - ${transaction.amount} Solar`);
    return transaction;
  }

  async getTransactionHistory(userId, limit = 50) {
    return await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.fromUserId, userId),
          eq(transactions.toUserId, userId)
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  // Purchase Operations
  async createPurchase(purchaseData) {
    const [purchase] = await this.db.insert(purchases).values(purchaseData).returning();
    console.log(`🛒 Purchase created: User ${purchase.userId} bought ${purchase.artifactId}`);
    return purchase;
  }

  async getUserPurchases(userId) {
    return await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
  }

  async checkPurchaseAccess(userId, artifactId) {
    const [purchase] = await this.db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.artifactId, artifactId)
        )
      );
    
    return !!purchase;
  }

  // Analytics Operations
  async getMarketplaceStats() {
    try {
      // Get total artifacts
      const artifactCount = await this.db.select().from(artifacts).where(eq(artifacts.isActive, true));
      
      // Get total transactions volume
      const allTransactions = await this.db.select().from(transactions).where(eq(transactions.status, 'completed'));
      const totalVolume = allTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      // Get total users
      const userCount = await this.db.select().from(marketplaceUsers);
      
      return {
        totalArtifacts: artifactCount.length,
        totalVolume: totalVolume.toFixed(4),
        totalUsers: userCount.length,
        totalTransactions: allTransactions.length
      };
    } catch (error) {
      console.error('Error getting marketplace stats:', error);
      return {
        totalArtifacts: 0,
        totalVolume: '0.0000',
        totalUsers: 0,
        totalTransactions: 0
      };
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.db.select().from(marketplaceUsers).limit(1);
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = DatabaseService;