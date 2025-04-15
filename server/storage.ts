import { users, type User, type InsertUser, productScans, type ProductScan, type InsertProductScan } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUserSolarBalance(id: number, solarBalance: number): Promise<User>;
  updateLastDistribution(id: number): Promise<User>;
  
  // Product scan methods
  getProductScans(userId: number): Promise<ProductScan[]>;
  createProductScan(scan: InsertProductScan): Promise<ProductScan>;
  
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserSolarBalance(id: number, solarBalance: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ solarBalance })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateLastDistribution(id: number): Promise<User> {
    const now = new Date();
    const [user] = await db
      .update(users)
      .set({ lastDistribution: now })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getProductScans(userId: number): Promise<ProductScan[]> {
    return await db
      .select()
      .from(productScans)
      .where(eq(productScans.userId, userId))
      .orderBy(productScans.scanDate);
  }

  async createProductScan(scan: InsertProductScan): Promise<ProductScan> {
    const [newScan] = await db
      .insert(productScans)
      .values(scan)
      .returning();
    return newScan;
  }
}

export const storage = new DatabaseStorage();