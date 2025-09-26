/**
 * Solar Ledger Service for TC-S Network Foundation Digital Artifact Marketplace
 * Manages Solar balances, transactions, and creator payments
 * Integrates with Foundation app for balance synchronization
 */

const Decimal = require('decimal.js');

// Configure Decimal.js for precise monetary calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

class LedgerService {
  constructor(databaseService) {
    this.db = databaseService;
    this.pendingTransactions = new Map(); // Keep pending in memory for speed
    
    console.log('💰 Solar Ledger Service initialized with database persistence');
  }

  /**
   * Get user's Solar balance
   */
  async getUserBalance(userId) {
    try {
      const user = await this.db.getUserById(userId);
      
      if (!user) {
        // User doesn't exist in marketplace DB, sync from Foundation
        const foundationBalance = await this.syncBalanceFromFoundation(userId);
        return foundationBalance; // syncBalanceFromFoundation now returns string
      }
      
      return new Decimal(user.solarBalance || '0').toString();
    } catch (error) {
      console.error('Error getting user balance:', error);
      return '0'; // Return string zero instead of numeric zero
    }
  }

  /**
   * Process artifact purchase with Solar
   */
  async processPurchase(purchaseData) {
    const { userId, artifactId, price, sellerId } = purchaseData;
    const transactionId = this.generateTransactionId();
    
    try {
      // Check user balance
      const userBalance = new Decimal(await this.getUserBalance(userId));
      const purchasePrice = new Decimal(price);
      if (userBalance.lessThan(purchasePrice)) {
        throw new Error('Insufficient Solar balance');
      }

      // Create pending transaction
      const transaction = {
        id: transactionId,
        type: 'purchase',
        userId,
        sellerId,
        artifactId,
        amount: price,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      this.pendingTransactions.set(transactionId, transaction);

      // Process the transaction
      await this.executeTransaction(transaction);

      return {
        success: true,
        transactionId,
        newBalance: await this.getUserBalance(userId)
      };

    } catch (error) {
      console.error('Purchase failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute the Solar transaction
   */
  async executeTransaction(transaction) {
    const { userId, sellerId, amount, id } = transaction;
    
    // Convert all values to Decimal for precise arithmetic
    const buyerBalance = new Decimal(await this.getUserBalance(userId));
    const transactionAmount = new Decimal(amount);
    const marketplaceFeeRate = new Decimal('0.15'); // 15% marketplace fee
    
    // Calculate precise values
    const marketplaceFee = transactionAmount.mul(marketplaceFeeRate);
    const sellerAmount = transactionAmount.minus(marketplaceFee);
    const newBuyerBalance = buyerBalance.minus(transactionAmount);
    
    // Get seller balance and calculate new balance
    const sellerBalance = new Decimal(await this.getUserBalance(sellerId));
    const newSellerBalance = sellerBalance.plus(sellerAmount);
    
    // Update balances using string values
    await this.db.updateUserBalance(userId, newBuyerBalance.toString());
    await this.db.updateUserBalance(sellerId, newSellerBalance.toString());

    // Record completed transaction in database
    const transactionData = {
      id: id,
      type: 'purchase',
      fromUserId: userId,
      toUserId: sellerId,
      amount: transactionAmount.toString(),
      status: 'completed',
      metadata: JSON.stringify({
        marketplaceFee: marketplaceFee.toString(),
        sellerAmount: sellerAmount.toString(),
        artifactId: transaction.artifactId
      })
    };
    
    await this.db.createTransaction(transactionData);
    this.pendingTransactions.delete(id);

    // Sync balance changes back to Foundation app
    await this.syncBalanceToFoundation(userId, newBuyerBalance.toString());
    await this.syncBalanceToFoundation(sellerId, newSellerBalance.toString());

    console.log(`✅ Transaction completed: ${transactionAmount} Solar - Buyer: ${userId}, Seller: ${sellerId}`);
  }

  /**
   * Add Solar to user balance (from Foundation daily distribution)
   */
  async addSolar(userId, amount, source = 'daily_distribution') {
    const currentBalance = new Decimal(await this.getUserBalance(userId));
    const addAmount = new Decimal(amount);
    const newBalance = currentBalance.plus(addAmount);
    
    await this.db.updateUserBalance(userId, newBalance.toString());
    
    // Record transaction
    const transactionId = this.generateTransactionId();
    const transactionData = {
      id: transactionId,
      type: 'credit',
      toUserId: userId,
      amount: addAmount.toString(),
      status: 'completed',
      metadata: JSON.stringify({ source })
    };
    
    await this.db.createTransaction(transactionData);
    
    console.log(`💰 Added ${addAmount} Solar to user ${userId} from ${source}`);
    return newBalance.toString();
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(userId, limit = 50) {
    return await this.db.getTransactionHistory(userId, limit);
  }

  /**
   * Sync balance from Foundation app
   */
  async syncBalanceFromFoundation(userId) {
    try {
      // This would make an API call to the Foundation app
      // For now, return default balance as string
      return '10.0000'; // Default starting balance
    } catch (error) {
      console.error('Failed to sync balance from Foundation:', error);
      return '0'; // Return string zero
    }
  }

  /**
   * Sync balance changes back to Foundation app
   */
  async syncBalanceToFoundation(userId, newBalance) {
    try {
      // This would make an API call to update Foundation app balance
      console.log(`🔄 Syncing balance to Foundation: User ${userId} = ${newBalance} Solar`);
      return true;
    } catch (error) {
      console.error('Failed to sync balance to Foundation:', error);
      return false;
    }
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats() {
    try {
      return await this.db.getMarketplaceStats();
    } catch (error) {
      console.error('Error getting marketplace stats:', error);
      return {
        totalTransactions: 0,
        totalVolume: '0.0000',
        totalFees: '0.0000',
        activeUsers: 0
      };
    }
  }
}

module.exports = LedgerService;