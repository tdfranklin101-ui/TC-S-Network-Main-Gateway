import { eq, desc, sql, and, or } from 'drizzle-orm';
import { db } from './db';
import { 
  members, distributionLogs, backupLogs, products, newsletterSubscriptions, contactMessages,
  progressions, entitlements, transactions, userProfiles, contentLibrary, users,
  type Member, type InsertMember, type DistributionLog, type InsertDistributionLog, 
  type BackupLog, type InsertBackupLog, type Product, type InsertProduct,
  type NewsletterSubscription, type InsertNewsletterSubscription,
  type ContactMessage, type InsertContactMessage, type Progression, type InsertProgression,
  type Entitlement, type InsertEntitlement, type Transaction, type InsertTransaction,
  type UserProfile, type InsertUserProfile, type ContentLibrary, type InsertContentLibrary,
  type User, type InsertUser
} from '../shared/schema';
import fs from 'fs';
import path from 'path';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Storage interface for member data and timer-gated progression
export interface IStorage {
  // Member operations
  getMembers(): Promise<Member[]>;
  getMember(id: number): Promise<Member | undefined>;
  getMemberByUsername(username: string): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  createMember(data: InsertMember): Promise<Member>;
  updateMember(id: number, data: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: number): Promise<boolean>;
  
  // Distribution operations
  createDistributionLog(data: InsertDistributionLog): Promise<DistributionLog>;
  getDistributionLogs(memberId?: number): Promise<DistributionLog[]>;
  getLastDistribution(memberId: number): Promise<DistributionLog | undefined>;
  
  // Backup operations
  createBackupLog(data: InsertBackupLog): Promise<BackupLog>;
  getBackupLogs(): Promise<BackupLog[]>;
  
  // Import/Export
  importMembersFromJson(filePath: string): Promise<{ success: boolean, imported: number, errors: any[] }>;
  exportMembersToJson(filePath: string): Promise<{ success: boolean, exported: number }>;
  
  // Migration assistance
  migrateFileBasedMembersToDatabase(membersList: any[]): Promise<{ success: boolean, migrated: number, errors: any[] }>;

  // User operations for timer-gated progression
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserCredentials(id: string, email: string, hashedPassword: string): Promise<User | undefined>;

  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(data: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;
  updateSolarBalance(userId: string, amount: number): Promise<UserProfile | undefined>;
  
  // Progression operations
  getProgression(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<Progression | undefined>;
  getUserProgressions(userId: string | null, sessionId: string | null): Promise<Progression[]>;
  createProgression(data: InsertProgression): Promise<Progression>;
  updateProgression(id: string, data: Partial<InsertProgression>): Promise<Progression | undefined>;
  startTimer(userId: string | null, sessionId: string | null, contentType: string, contentId: string, duration: number): Promise<Progression>;
  completeTimer(progressionId: string): Promise<Progression | undefined>;
  
  // Entitlement operations
  getEntitlement(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<Entitlement | undefined>;
  getUserEntitlements(userId: string | null, sessionId: string | null): Promise<Entitlement[]>;
  createEntitlement(data: InsertEntitlement): Promise<Entitlement>;
  revokeEntitlement(id: string): Promise<boolean>;
  
  // Transaction operations
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: string, completedAt?: Date): Promise<Transaction | undefined>;
  
  // Content library operations
  getContentLibrary(): Promise<ContentLibrary[]>;
  getContentItem(contentType: string, contentId: string): Promise<ContentLibrary | undefined>;
  createContentItem(data: InsertContentLibrary): Promise<ContentLibrary>;
  updateContentItem(id: string, data: Partial<InsertContentLibrary>): Promise<ContentLibrary | undefined>;
  
  // Composite operations for progression flow
  canAccessContent(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<{
    canAccess: boolean;
    accessType: 'locked' | 'timer_active' | 'timer_complete' | 'preview' | 'full';
    timeRemaining?: number;
    solarCost?: number;
    progression?: Progression;
    entitlement?: Entitlement;
    userBalance?: number;
  }>;
  unlockContentWithPayment(userId: string, contentType: string, contentId: string, solarCost: number): Promise<{
    success: boolean;
    entitlement?: Entitlement;
    transaction?: Transaction;
    error?: string;
  }>;

  // Unlock content with Solar tokens
  unlockWithSolar(userId: string, contentType: string, contentId: string): Promise<{
    success: boolean;
    entitlement?: Entitlement;
    transaction?: Transaction;
    newBalance?: number;
    error?: string;
    message?: string;
  }>;

  // Transfer session progressions to user account
  transferSessionProgressions(sessionId: string, userId: string): Promise<void>;

  // Product operations
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Newsletter subscription operations  
  createNewsletterSubscription(data: InsertNewsletterSubscription): Promise<NewsletterSubscription>;
  getNewsletterSubscriptions(): Promise<NewsletterSubscription[]>;
  getNewsletterSubscriptionByEmail(email: string): Promise<NewsletterSubscription | undefined>;
  unsubscribeNewsletter(email: string): Promise<boolean>;

  // Contact message operations
  createContactMessage(data: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  getContactMessage(id: string): Promise<ContactMessage | undefined>;
  updateContactMessageStatus(id: string, status: string): Promise<ContactMessage | undefined>;

  // Solar accounts (legacy member system compatibility)
  getAllSolarAccounts(limit?: number, includeAnonymous?: boolean): Promise<Member[]>;
  createSolarAccount(data: { userId: string; isAnonymous: boolean; displayName: string }): Promise<Member>;
  
  // Session store for passport sessions
  sessionStore: any;
}

// Implementation of the storage interface using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Session store for passport sessions
  sessionStore: any;

  constructor() {
    // Initialize session store with PostgreSQL
    const PgSession = connectPgSimple(session);
    this.sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session'
    });
  }
  // Member operations
  async getMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(members.id);
  }
  
  async getMember(id: number): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.id, id));
    return result[0];
  }
  
  async getMemberByUsername(username: string): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.username, username));
    return result[0];
  }
  
  async getMemberByEmail(email: string): Promise<Member | undefined> {
    const result = await db.select().from(members).where(eq(members.email, email));
    return result[0];
  }
  
  async createMember(data: InsertMember): Promise<Member> {
    const result = await db.insert(members).values(data).returning();
    return result[0];
  }
  
  async updateMember(id: number, data: Partial<InsertMember>): Promise<Member | undefined> {
    const result = await db.update(members)
      .set(data)
      .where(eq(members.id, id))
      .returning();
    return result[0];
  }
  
  async deleteMember(id: number): Promise<boolean> {
    const result = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
    return result.length > 0;
  }
  
  // Distribution operations
  async createDistributionLog(data: InsertDistributionLog): Promise<DistributionLog> {
    const result = await db.insert(distributionLogs).values(data).returning();
    return result[0];
  }
  
  async getDistributionLogs(memberId?: number): Promise<DistributionLog[]> {
    if (memberId) {
      return await db.select()
        .from(distributionLogs)
        .where(eq(distributionLogs.memberId, memberId))
        .orderBy(desc(distributionLogs.timestamp));
    }
    return await db.select()
      .from(distributionLogs)
      .orderBy(desc(distributionLogs.timestamp));
  }
  
  async getLastDistribution(memberId: number): Promise<DistributionLog | undefined> {
    const result = await db.select()
      .from(distributionLogs)
      .where(eq(distributionLogs.memberId, memberId))
      .orderBy(desc(distributionLogs.timestamp))
      .limit(1);
    return result[0];
  }
  
  // Backup operations
  async createBackupLog(data: InsertBackupLog): Promise<BackupLog> {
    const result = await db.insert(backupLogs).values(data).returning();
    return result[0];
  }
  
  async getBackupLogs(): Promise<BackupLog[]> {
    return await db.select()
      .from(backupLogs)
      .orderBy(desc(backupLogs.timestamp));
  }
  
  // Import/Export
  async importMembersFromJson(filePath: string): Promise<{ success: boolean, imported: number, errors: any[] }> {
    try {
      const jsonData = fs.readFileSync(filePath, 'utf8');
      const memberList = JSON.parse(jsonData);
      const result = await this.migrateFileBasedMembersToDatabase(memberList);
      return {
        success: result.success,
        imported: result.migrated,
        errors: result.errors
      };
    } catch (error) {
      return { success: false, imported: 0, errors: [error] };
    }
  }
  
  async exportMembersToJson(filePath: string): Promise<{ success: boolean, exported: number }> {
    try {
      const members = await this.getMembers();
      fs.writeFileSync(filePath, JSON.stringify(members, null, 2));
      return { success: true, exported: members.length };
    } catch (error) {
      return { success: false, exported: 0 };
    }
  }
  
  // User operations for timer-gated progression
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(data: InsertUser): Promise<User> {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserCredentials(id: string, email: string, hashedPassword: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ email, password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return result[0];
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const result = await db.insert(userProfiles).values(data).returning();
    return result[0];
  }

  async updateUserProfile(userId: string, data: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const result = await db.update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async updateSolarBalance(userId: string, amount: number): Promise<UserProfile | undefined> {
    const result = await db.update(userProfiles)
      .set({ 
        solarBalance: sql`${userProfiles.solarBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return result[0];
  }

  // Progression operations
  async getProgression(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<Progression | undefined> {
    const whereClause = and(
      eq(progressions.contentType, contentType),
      eq(progressions.contentId, contentId),
      userId ? eq(progressions.userId, userId) : eq(progressions.sessionId, sessionId || '')
    );
    
    const result = await db.select().from(progressions).where(whereClause);
    return result[0];
  }

  async getUserProgressions(userId: string | null, sessionId: string | null): Promise<Progression[]> {
    const whereClause = userId 
      ? eq(progressions.userId, userId)
      : eq(progressions.sessionId, sessionId || '');
    
    return await db.select()
      .from(progressions)
      .where(whereClause)
      .orderBy(desc(progressions.createdAt));
  }

  async createProgression(data: InsertProgression): Promise<Progression> {
    const result = await db.insert(progressions).values(data).returning();
    return result[0];
  }

  async updateProgression(id: string, data: Partial<InsertProgression>): Promise<Progression | undefined> {
    const result = await db.update(progressions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(progressions.id, id))
      .returning();
    return result[0];
  }

  async startTimer(userId: string | null, sessionId: string | null, contentType: string, contentId: string, duration: number): Promise<Progression> {
    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 1000);
    
    const data: InsertProgression = {
      userId,
      sessionId,
      contentType,
      contentId,
      status: 'timer_active',
      timerStartTime: now,
      timerDuration: duration,
      timerEndTime: endTime,
      unlockMethod: 'timer'
    };

    return await this.createProgression(data);
  }

  async completeTimer(progressionId: string): Promise<Progression | undefined> {
    return await this.updateProgression(progressionId, {
      status: 'timer_complete'
    });
  }

  // Entitlement operations
  async getEntitlement(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<Entitlement | undefined> {
    const whereClause = and(
      eq(entitlements.contentType, contentType),
      eq(entitlements.contentId, contentId),
      userId ? eq(entitlements.userId, userId) : eq(entitlements.sessionId, sessionId || ''),
      or(
        sql`${entitlements.expiresAt} IS NULL`,
        sql`${entitlements.expiresAt} > NOW()`
      )
    );
    
    const result = await db.select().from(entitlements).where(whereClause);
    return result[0];
  }

  async getUserEntitlements(userId: string | null, sessionId: string | null): Promise<Entitlement[]> {
    const whereClause = and(
      userId ? eq(entitlements.userId, userId) : eq(entitlements.sessionId, sessionId || ''),
      or(
        sql`${entitlements.expiresAt} IS NULL`,
        sql`${entitlements.expiresAt} > NOW()`
      )
    );
    
    return await db.select()
      .from(entitlements)
      .where(whereClause)
      .orderBy(desc(entitlements.createdAt));
  }

  async createEntitlement(data: InsertEntitlement): Promise<Entitlement> {
    const result = await db.insert(entitlements).values(data).returning();
    return result[0];
  }

  async revokeEntitlement(id: string): Promise<boolean> {
    const result = await db.delete(entitlements).where(eq(entitlements.id, id)).returning({ id: entitlements.id });
    return result.length > 0;
  }

  // Transaction operations
  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(data).returning();
    return result[0];
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async updateTransactionStatus(id: string, status: string, completedAt?: Date): Promise<Transaction | undefined> {
    const updateData: Partial<InsertTransaction> = { status };
    if (completedAt) {
      updateData.completedAt = completedAt;
    }
    
    const result = await db.update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  // Content library operations
  async getContentLibrary(): Promise<ContentLibrary[]> {
    return await db.select()
      .from(contentLibrary)
      .where(eq(contentLibrary.isActive, true))
      .orderBy(contentLibrary.sortOrder, contentLibrary.createdAt);
  }

  async getContentItem(contentType: string, contentId: string): Promise<ContentLibrary | undefined> {
    const result = await db.select()
      .from(contentLibrary)
      .where(and(
        eq(contentLibrary.contentType, contentType),
        eq(contentLibrary.contentId, contentId),
        eq(contentLibrary.isActive, true)
      ));
    return result[0];
  }

  async createContentItem(data: InsertContentLibrary): Promise<ContentLibrary> {
    const result = await db.insert(contentLibrary).values(data).returning();
    return result[0];
  }

  async updateContentItem(id: string, data: Partial<InsertContentLibrary>): Promise<ContentLibrary | undefined> {
    const result = await db.update(contentLibrary)
      .set(data)
      .where(eq(contentLibrary.id, id))
      .returning();
    return result[0];
  }

  // Composite operations for progression flow
  async canAccessContent(userId: string | null, sessionId: string | null, contentType: string, contentId: string): Promise<{
    canAccess: boolean;
    accessType: 'locked' | 'timer_active' | 'timer_complete' | 'preview' | 'full';
    timeRemaining?: number;
    solarCost?: number;
    progression?: Progression;
    entitlement?: Entitlement;
    userBalance?: number;
  }> {
    // Get user balance if userId is provided
    let userBalance: number | undefined;
    if (userId) {
      const userProfile = await this.getUserProfile(userId);
      userBalance = userProfile?.solarBalance ?? undefined;
    }

    // Check for existing entitlement
    const entitlement = await this.getEntitlement(userId, sessionId, contentType, contentId);
    if (entitlement && entitlement.accessType === 'full') {
      return {
        canAccess: true,
        accessType: 'full',
        entitlement,
        userBalance
      };
    }

    // Check progression status
    const progression = await this.getProgression(userId, sessionId, contentType, contentId);
    const contentItem = await this.getContentItem(contentType, contentId);

    if (!contentItem) {
      return {
        canAccess: false,
        accessType: 'locked',
        userBalance
      };
    }

    // If no progression exists, content is locked
    if (!progression) {
      return {
        canAccess: true,
        accessType: 'preview',
        solarCost: contentItem.solarCost || 0,
        userBalance
      };
    }

    // Check timer status
    if (progression.status === 'timer_active') {
      const now = new Date();
      const endTime = new Date(progression.timerEndTime!);
      const timeRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      
      if (timeRemaining > 0) {
        return {
          canAccess: true,
          accessType: 'timer_active',
          timeRemaining,
          progression,
          userBalance
        };
      } else {
        // Timer expired, update status
        await this.completeTimer(progression.id);
        return {
          canAccess: true,
          accessType: 'timer_complete',
          solarCost: contentItem.solarCost || 0,
          progression,
          userBalance
        };
      }
    }

    if (progression.status === 'timer_complete') {
      return {
        canAccess: true,
        accessType: 'timer_complete',
        solarCost: contentItem.solarCost || 0,
        progression,
        userBalance
      };
    }

    if (progression.status === 'unlocked') {
      return {
        canAccess: true,
        accessType: 'full',
        progression,
        userBalance
      };
    }

    // Default to preview
    return {
      canAccess: true,
      accessType: 'preview',
      solarCost: contentItem.solarCost || 0,
      userBalance
    };
  }

  async unlockContentWithPayment(userId: string, contentType: string, contentId: string, solarCost: number): Promise<{
    success: boolean;
    entitlement?: Entitlement;
    transaction?: Transaction;
    error?: string;
  }> {
    return await db.transaction(async (tx) => {
      try {
        // Check user's solar balance
        const userProfile = await this.getUserProfile(userId);
        if (!userProfile || (userProfile.solarBalance ?? 0) < solarCost) {
          return {
            success: false,
            error: 'Insufficient Solar balance'
          };
        }

        // Create spending transaction
        const transaction = await this.createTransaction({
          userId,
          type: 'solar_spend',
          amount: solarCost,
          currency: 'SOLAR',
          status: 'completed',
          description: `Unlock ${contentType}: ${contentId}`,
          completedAt: new Date()
        });

        // Update user's solar balance
        await this.updateSolarBalance(userId, -solarCost);
        // Update total spent using raw SQL
        await db.update(userProfiles)
          .set({ 
            totalSpent: sql`${userProfiles.totalSpent} + ${solarCost}`,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, userId));

        // Create entitlement
        const entitlement = await this.createEntitlement({
          userId,
          contentType,
          contentId,
          accessType: 'full',
          purchaseMethod: 'solar',
          solarCost
        });

        // Update progression status if exists
        const progression = await this.getProgression(userId, null, contentType, contentId);
        if (progression) {
          await this.updateProgression(progression.id, {
            status: 'unlocked',
            unlockMethod: 'payment'
          });
        }

        return {
          success: true,
          entitlement,
          transaction
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Payment failed'
        };
      }
    });
  }

  // Unlock content with Solar tokens
  async unlockWithSolar(userId: string, contentType: string, contentId: string): Promise<{
    success: boolean;
    entitlement?: Entitlement;
    transaction?: Transaction;
    newBalance?: number;
    error?: string;
    message?: string;
  }> {
    return await db.transaction(async (tx) => {
      try {
        // Get content item to check cost
        const contentItem = await this.getContentItem(contentType, contentId);
        if (!contentItem) {
          return {
            success: false,
            error: 'Content not found',
            message: 'The requested content does not exist'
          };
        }

        const solarCost = contentItem.solarCost || 0;
        if (solarCost <= 0) {
          return {
            success: false,
            error: 'Content is free',
            message: 'This content does not require Solar tokens'
          };
        }

        // Check user's solar balance
        const userProfile = await this.getUserProfile(userId);
        if (!userProfile || (userProfile.solarBalance ?? 0) < solarCost) {
          return {
            success: false,
            error: 'Insufficient Solar balance',
            message: `You need ${solarCost} Solar tokens but only have ${userProfile?.solarBalance || 0}`
          };
        }

        // Create spending transaction
        const transaction = await this.createTransaction({
          userId,
          type: 'solar_spend',
          amount: solarCost,
          currency: 'SOLAR',
          status: 'completed',
          description: `Unlock ${contentType}: ${contentId}`,
          completedAt: new Date()
        });

        // Update user's solar balance
        const updatedProfile = await this.updateSolarBalance(userId, -solarCost);
        
        // Update total spent using raw SQL
        await db.update(userProfiles)
          .set({ 
            totalSpent: sql`${userProfiles.totalSpent} + ${solarCost}`,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, userId));

        // Create entitlement
        const entitlement = await this.createEntitlement({
          userId,
          contentType,
          contentId,
          accessType: 'full',
          purchaseMethod: 'solar',
          solarCost
        });

        // Update progression status if exists
        const progression = await this.getProgression(userId, null, contentType, contentId);
        if (progression) {
          await this.updateProgression(progression.id, {
            status: 'unlocked',
            unlockMethod: 'payment'
          });
        }

        return {
          success: true,
          entitlement,
          transaction,
          newBalance: updatedProfile?.solarBalance || 0,
          message: `Successfully unlocked ${contentType} for ${solarCost} Solar tokens`
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Payment failed',
          message: 'An error occurred while processing your Solar payment'
        };
      }
    });
  }

  // Transfer session progressions to user account
  async transferSessionProgressions(sessionId: string, userId: string): Promise<void> {
    try {
      // Find all progressions for this session ID
      const sessionProgressions = await db.select()
        .from(progressions)
        .where(and(
          eq(progressions.sessionId, sessionId),
          sql`${progressions.userId} IS NULL`
        ));

      // Transfer each progression to the user
      for (const progression of sessionProgressions) {
        await db.update(progressions)
          .set({
            userId: userId,
            sessionId: null, // Clear session ID since we now have a user ID
            updatedAt: new Date()
          })
          .where(eq(progressions.id, progression.id));
      }

      console.log(`Transferred ${sessionProgressions.length} progressions from session ${sessionId} to user ${userId}`);
    } catch (error) {
      console.error('Error transferring session progressions:', error);
      throw error;
    }
  }

  // Product operations
  async getAllProducts(): Promise<Product[]> {
    return await db.select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.createdAt);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(data).returning();
    return result[0];
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return result.length > 0;
  }

  // Newsletter subscription operations
  async createNewsletterSubscription(data: InsertNewsletterSubscription): Promise<NewsletterSubscription> {
    const result = await db.insert(newsletterSubscriptions).values(data).returning();
    return result[0];
  }

  async getNewsletterSubscriptions(): Promise<NewsletterSubscription[]> {
    return await db.select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.status, 'active'))
      .orderBy(desc(newsletterSubscriptions.subscribedAt));
  }

  async getNewsletterSubscriptionByEmail(email: string): Promise<NewsletterSubscription | undefined> {
    const result = await db.select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, email));
    return result[0];
  }

  async unsubscribeNewsletter(email: string): Promise<boolean> {
    const result = await db.update(newsletterSubscriptions)
      .set({ 
        status: 'unsubscribed',
        unsubscribedAt: new Date()
      })
      .where(eq(newsletterSubscriptions.email, email))
      .returning({ id: newsletterSubscriptions.id });
    return result.length > 0;
  }

  // Contact message operations
  async createContactMessage(data: InsertContactMessage): Promise<ContactMessage> {
    const result = await db.insert(contactMessages).values(data).returning();
    return result[0];
  }

  async getContactMessages(): Promise<ContactMessage[]> {
    return await db.select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));
  }

  async getContactMessage(id: string): Promise<ContactMessage | undefined> {
    const result = await db.select().from(contactMessages).where(eq(contactMessages.id, id));
    return result[0];
  }

  async updateContactMessageStatus(id: string, status: string): Promise<ContactMessage | undefined> {
    const updateData: Partial<InsertContactMessage> = { status };
    if (status === 'replied') {
      updateData.repliedAt = new Date();
    }
    
    const result = await db.update(contactMessages)
      .set(updateData)
      .where(eq(contactMessages.id, id))
      .returning();
    return result[0];
  }

  // Solar accounts (legacy member system compatibility)
  async getAllSolarAccounts(limit?: number, includeAnonymous?: boolean): Promise<Member[]> {
    const baseQuery = db.select().from(members);
    
    if (!includeAnonymous && limit) {
      return await baseQuery
        .where(eq(members.isAnonymous, false))
        .orderBy(desc(members.createdAt))
        .limit(limit);
    } else if (!includeAnonymous) {
      return await baseQuery
        .where(eq(members.isAnonymous, false))
        .orderBy(desc(members.createdAt));
    } else if (limit) {
      return await baseQuery
        .orderBy(desc(members.createdAt))
        .limit(limit);
    } else {
      return await baseQuery
        .orderBy(desc(members.createdAt));
    }
  }

  async createSolarAccount(data: { userId: string; isAnonymous: boolean; displayName: string }): Promise<Member> {
    // Create a member record for the solar account
    const memberData = {
      username: `user_${data.userId}`,
      name: data.displayName,
      email: '', // Will be updated from user data if available
      isAnonymous: data.isAnonymous,
      totalSolar: '0',
      totalDollars: '0'
    };
    
    const result = await db.insert(members).values(memberData).returning();
    return result[0];
  }


  // Migration assistance
  async migrateFileBasedMembersToDatabase(membersList: any[]): Promise<{ success: boolean, migrated: number, errors: any[] }> {
    const errors: any[] = [];
    let migratedCount = 0;
    
    try {
      // Begin transaction
      await db.transaction(async (tx) => {
        for (const memberData of membersList) {
          // Skip placeholders
          if (memberData.isPlaceholder) {
            continue;
          }
          
          try {
            // Prepare member data for database
            const insertData: InsertMember = {
              username: memberData.username,
              name: memberData.name,
              email: memberData.email || `${memberData.username}@thecurrentsee.org`,
              joinedDate: memberData.joinedDate,
              totalSolar: memberData.totalSolar.toString(),
              totalDollars: memberData.totalDollars.toString(),
              isAnonymous: memberData.isAnonymous || false,
              isReserve: memberData.isReserve || false,
              lastDistributionDate: memberData.lastDistributionDate,
              notes: memberData.notes || null
            };
            
            // Check if member already exists (by username)
            const existingMember = await tx.select()
              .from(members)
              .where(eq(members.username, memberData.username))
              .limit(1);
            
            if (existingMember.length === 0) {
              // Create new member
              await tx.insert(members).values(insertData);
              migratedCount++;
            } else {
              // Update existing member
              await tx.update(members)
                .set(insertData)
                .where(eq(members.username, memberData.username));
              migratedCount++;
            }
          } catch (memberError: unknown) {
            errors.push({
              member: memberData.username,
              error: memberError instanceof Error ? memberError.message : String(memberError)
            });
          }
        }
      });
      
      return {
        success: errors.length === 0,
        migrated: migratedCount,
        errors
      };
    } catch (error: unknown) {
      return {
        success: false,
        migrated: migratedCount,
        errors: [...errors, error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

// Export an instance of the storage
export const storage = new DatabaseStorage();