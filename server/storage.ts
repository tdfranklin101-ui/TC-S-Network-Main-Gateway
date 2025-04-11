import {
  User,
  InsertUser,
  Product,
  InsertProduct,
  NewsletterSubscription,
  InsertNewsletterSubscription,
  ContactMessage,
  InsertContactMessage,
  SolarAccount,
  InsertSolarAccount,
  Distribution,
  InsertDistribution,
  users,
  products,
  newsletterSubscriptions,
  contactMessages,
  solarAccounts,
  distributions
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

// Interface for storage operations
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product methods
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Newsletter subscription methods
  createNewsletterSubscription(subscription: InsertNewsletterSubscription): Promise<NewsletterSubscription>;
  
  // Contact message methods
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;

  // Solar account methods
  getSolarAccount(id: number): Promise<SolarAccount | undefined>;
  getSolarAccountByUserId(userId: number): Promise<SolarAccount | undefined>;
  getSolarAccountByAccountNumber(accountNumber: string): Promise<SolarAccount | undefined>;
  createSolarAccount(account: Omit<InsertSolarAccount, 'accountNumber'>): Promise<SolarAccount>;
  updateSolarAccountTotals(id: number, solarAmount: number, kwhAmount: number, dollarValue: number): Promise<SolarAccount>;
  getAllSolarAccounts(limit?: number, includeAnonymous?: boolean): Promise<SolarAccount[]>;
  
  // Distribution methods
  createDistribution(distribution: InsertDistribution): Promise<Distribution>;
  getDistributionsByUserId(userId: number): Promise<Distribution[]>;
  getDistributionsBySolarAccountId(solarAccountId: number): Promise<Distribution[]>;
  getDistributionsByDate(date: Date): Promise<Distribution[]>;
  processDistributions(date: Date): Promise<number>; // Returns number of processed distributions

  // Session store
  sessionStore: session.Store;
}

// Database-backed storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });

    // Initialize the database with sample products if needed
    this.initializeSampleProductsIfNeeded();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.username, username));
    return results[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    const results = await db.select().from(products).where(eq(products.id, id));
    return results[0];
  }
  
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }
  
  // Newsletter subscription methods
  async createNewsletterSubscription(insertSubscription: InsertNewsletterSubscription): Promise<NewsletterSubscription> {
    const [subscription] = await db
      .insert(newsletterSubscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }
  
  // Contact message methods
  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const [message] = await db
      .insert(contactMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  // Solar account methods
  async getSolarAccount(id: number): Promise<SolarAccount | undefined> {
    const results = await db.select().from(solarAccounts).where(eq(solarAccounts.id, id));
    return results[0];
  }

  async getSolarAccountByUserId(userId: number): Promise<SolarAccount | undefined> {
    const results = await db.select().from(solarAccounts).where(eq(solarAccounts.userId, userId));
    return results[0];
  }

  async getSolarAccountByAccountNumber(accountNumber: string): Promise<SolarAccount | undefined> {
    const results = await db.select().from(solarAccounts).where(eq(solarAccounts.accountNumber, accountNumber));
    return results[0];
  }

  async createSolarAccount(account: Omit<InsertSolarAccount, 'accountNumber'>): Promise<SolarAccount> {
    // Generate a unique account number
    const accountNumber = this.generateAccountNumber();
    
    const [solarAccount] = await db
      .insert(solarAccounts)
      .values({
        ...account,
        accountNumber,
      })
      .returning();
    
    return solarAccount;
  }

  async updateSolarAccountTotals(id: number, solarAmount: number, kwhAmount: number, dollarValue: number): Promise<SolarAccount> {
    const [updated] = await db
      .update(solarAccounts)
      .set({
        totalSolar: sql`${solarAccounts.totalSolar} + ${solarAmount}`,
        totalKwh: sql`${solarAccounts.totalKwh} + ${kwhAmount}`,
        totalDollars: sql`${solarAccounts.totalDollars} + ${dollarValue}`,
      })
      .where(eq(solarAccounts.id, id))
      .returning();
    
    return updated;
  }

  async getAllSolarAccounts(limit = 50, includeAnonymous = false): Promise<SolarAccount[]> {
    let query = db.select().from(solarAccounts).orderBy(asc(solarAccounts.joinedDate)).limit(limit);
    
    if (!includeAnonymous) {
      query = query.where(eq(solarAccounts.isAnonymous, false));
    }
    
    return await query;
  }

  // Distribution methods
  async createDistribution(distribution: InsertDistribution): Promise<Distribution> {
    const [newDistribution] = await db
      .insert(distributions)
      .values(distribution)
      .returning();
    
    return newDistribution;
  }

  async getDistributionsByUserId(userId: number): Promise<Distribution[]> {
    return await db
      .select()
      .from(distributions)
      .where(eq(distributions.userId, userId))
      .orderBy(desc(distributions.distributionDate));
  }

  async getDistributionsBySolarAccountId(solarAccountId: number): Promise<Distribution[]> {
    return await db
      .select()
      .from(distributions)
      .where(eq(distributions.solarAccountId, solarAccountId))
      .orderBy(desc(distributions.distributionDate));
  }

  async getDistributionsByDate(date: Date): Promise<Distribution[]> {
    // Convert date to YYYY-MM-DD format for comparison
    const formattedDate = date.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(distributions)
      .where(sql`CAST(${distributions.distributionDate} AS TEXT) = ${formattedDate}`);
  }

  async processDistributions(date: Date): Promise<number> {
    // Find all pending distributions for the given date
    const pendingDistributions = await db
      .select()
      .from(distributions)
      .where(
        and(
          sql`CAST(${distributions.distributionDate} AS TEXT) = ${date.toISOString().split('T')[0]}`,
          eq(distributions.status, 'pending')
        )
      );
    
    let processedCount = 0;
    
    // Process each distribution and update the corresponding solar account
    for (const distribution of pendingDistributions) {
      try {
        // Update the solar account totals
        await this.updateSolarAccountTotals(
          distribution.solarAccountId,
          Number(distribution.solarAmount),
          Number(distribution.kwhAmount),
          Number(distribution.dollarValue)
        );
        
        // Mark the distribution as processed
        await db
          .update(distributions)
          .set({
            status: 'processed',
            processedAt: new Date()
          })
          .where(eq(distributions.id, distribution.id));
        
        processedCount++;
      } catch (error) {
        console.error(`Failed to process distribution ${distribution.id}:`, error);
        
        // Mark the distribution as failed
        await db
          .update(distributions)
          .set({
            status: 'failed'
          })
          .where(eq(distributions.id, distribution.id));
      }
    }
    
    return processedCount;
  }

  // Helper methods
  private generateAccountNumber(): string {
    const prefix = 'SOL';
    const randomPart = randomBytes(8).toString('hex').toUpperCase().substring(0, 12);
    return `${prefix}-${randomPart}`;
  }

  // Initialize sample products if needed
  private async initializeSampleProductsIfNeeded() {
    const existingProducts = await this.getAllProducts();
    
    if (existingProducts.length === 0) {
      const sampleProducts: InsertProduct[] = [
        {
          name: "Solar Future T-Shirt",
          description: "100% organic cotton t-shirt featuring our \"Power the Future\" design.",
          price: 2999, // $29.99
          imageUrl: "https://images.unsplash.com/photo-1618354691792-d1d42acfd860?auto=format&fit=crop&w=600&h=400&q=80",
          isNew: true
        },
        {
          name: "Solar Power Bank",
          description: "10,000mAh solar-rechargeable power bank with Current-See branding.",
          price: 4999, // $49.99
          imageUrl: "https://images.unsplash.com/photo-1603557244695-37478f2ef0c1?auto=format&fit=crop&w=600&h=400&q=80",
          isNew: false
        },
        {
          name: "Insulated Water Bottle",
          description: "Stainless steel insulated bottle with our mission statement and logo.",
          price: 3499, // $34.99
          imageUrl: "https://images.unsplash.com/photo-1618403323851-eb733d77465b?auto=format&fit=crop&w=600&h=400&q=80",
          isNew: false
        }
      ];
      
      for (const product of sampleProducts) {
        await this.createProduct(product);
      }
    }
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
