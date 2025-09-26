/**
 * Ledger Service for TC-S Marketplace SOLAR tokens
 */

class LedgerService {
  constructor(database) {
    this.db = database;
    this.userBalances = new Map();
    this.transactions = [];
    this.initializeBalances();
  }

  initializeBalances() {
    this.userBalances.set('creator_tc_s', 10000);
    this.userBalances.set('buyer_demo', 500);
  }

  async getUserBalance(userId) {
    return this.userBalances.get(userId) || 0;
  }

  async processPurchase(purchaseData) {
    const { userId, artifactId, price, sellerId } = purchaseData;
    const buyerBalance = this.userBalances.get(userId) || 0;
    
    if (buyerBalance < price) {
      throw new Error('Insufficient SOLAR balance');
    }

    const sellerBalance = this.userBalances.get(sellerId) || 0;
    this.userBalances.set(userId, buyerBalance - price);
    this.userBalances.set(sellerId, sellerBalance + price);

    const transaction = {
      id: `tx_${Date.now()}`,
      type: 'purchase',
      buyerId: userId,
      sellerId: sellerId,
      artifactId: artifactId,
      amount: price,
      timestamp: new Date().toISOString(),
      status: 'completed'
    };

    this.transactions.push(transaction);
    if (this.db) {
      await this.db.recordTransaction(transaction);
    }

    return {
      success: true,
      transaction: transaction,
      buyerNewBalance: this.userBalances.get(userId),
      sellerNewBalance: this.userBalances.get(sellerId)
    };
  }
}

module.exports = LedgerService;