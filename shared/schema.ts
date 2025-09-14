import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Kid Solar Memory Sessions
export const kidSolarSessions = pgTable("kid_solar_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id"), // Optional user identification
  startTime: timestamp("start_time").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"), // Session metadata and user decisions
});

// Session Buffer for temporary storage before commitment
export const kidSolarSessionBuffer = pgTable("kid_solar_session_buffer", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  userId: varchar("user_id"),
  startTime: timestamp("start_time").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
  isActive: boolean("is_active").default(true),
  messageCount: integer("message_count").default(0),
  imageCount: integer("image_count").default(0),
  bufferData: jsonb("buffer_data"), // Temporary conversation and image data
  metadata: jsonb("metadata"), // Session state and triggers
});

// Kid Solar Memory Entries (images and analyses)
export const kidSolarMemories = pgTable("kid_solar_memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kidSolarSessions.id),
  memoryType: varchar("memory_type").notNull(), // 'image', 'text', 'analysis'
  imageUrl: varchar("image_url"), // For uploaded images
  imageBase64: text("image_base64"), // Base64 encoded image data
  fileName: varchar("file_name"),
  fileType: varchar("file_type"),
  analysisText: text("analysis_text"), // OpenAI analysis results
  userMessage: text("user_message"), // User's accompanying text
  kidSolarResponse: text("kid_solar_response"), // Kid Solar's response
  energyKwh: varchar("energy_kwh"), // Energy calculation
  solarTokens: varchar("solar_tokens"), // SOLAR token calculation
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"), // Additional context data
});

// Conversation History
export const kidSolarConversations = pgTable("kid_solar_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kidSolarSessions.id),
  memoryId: varchar("memory_id").references(() => kidSolarMemories.id),
  messageType: varchar("message_type").notNull(), // 'user', 'kid_solar', 'system'
  messageText: text("message_text").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Insert schemas
export const insertKidSolarSessionSchema = createInsertSchema(kidSolarSessions);
export const insertKidSolarMemorySchema = createInsertSchema(kidSolarMemories);
export const insertKidSolarConversationSchema = createInsertSchema(kidSolarConversations);
export const insertKidSolarSessionBufferSchema = createInsertSchema(kidSolarSessionBuffer);

// Select types
export type KidSolarSession = typeof kidSolarSessions.$inferSelect;
export type KidSolarMemory = typeof kidSolarMemories.$inferSelect;
export type KidSolarConversation = typeof kidSolarConversations.$inferSelect;
export type KidSolarSessionBuffer = typeof kidSolarSessionBuffer.$inferSelect;

// Insert types
export type InsertKidSolarSession = z.infer<typeof insertKidSolarSessionSchema>;
export type InsertKidSolarMemory = z.infer<typeof insertKidSolarMemorySchema>;
export type InsertKidSolarConversation = z.infer<typeof insertKidSolarConversationSchema>;
export type InsertKidSolarSessionBuffer = z.infer<typeof insertKidSolarSessionBufferSchema>;

// User signup table
export const signups = pgTable("signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  email: varchar("email"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Existing user tables (if they exist)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertSignupSchema = createInsertSchema(signups);

// Select types
export type Signup = typeof signups.$inferSelect;
export type User = typeof users.$inferSelect;

// Insert types
export type InsertSignup = z.infer<typeof insertSignupSchema>;
export type InsertUser = typeof users.$inferInsert;

// Timer-gated progression system tables

// User progressions through content
export const progressions = pgTable("progressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id"), // For anonymous users
  contentType: varchar("content_type").notNull(), // 'music_track', 'page', 'feature'
  contentId: varchar("content_id").notNull(), // Track ID, page ID, etc.
  status: varchar("status").notNull(), // 'locked', 'timer_active', 'timer_complete', 'unlocked'
  timerStartTime: timestamp("timer_start_time"),
  timerDuration: integer("timer_duration"), // Duration in seconds
  timerEndTime: timestamp("timer_end_time"),
  unlockMethod: varchar("unlock_method"), // 'timer', 'payment', 'registration'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User entitlements to content
export const entitlements = pgTable("entitlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id"), // For anonymous users
  contentType: varchar("content_type").notNull(),
  contentId: varchar("content_id").notNull(),
  accessType: varchar("access_type").notNull(), // 'preview', 'full', 'permanent'
  purchaseMethod: varchar("purchase_method"), // 'solar', 'stripe', 'free', 'registration'
  solarCost: integer("solar_cost"), // Cost in Solar tokens
  expiresAt: timestamp("expires_at"), // For temporary access
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction log for Solar payments and Stripe top-ups
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'solar_spend', 'stripe_topup', 'registration_bonus'
  amount: integer("amount").notNull(), // Amount in Solar tokens (for spend) or cents (for Stripe)
  currency: varchar("currency").default('SOLAR'), // 'SOLAR' or 'USD'
  status: varchar("status").notNull(), // 'pending', 'completed', 'failed', 'refunded'
  stripePaymentIntentId: varchar("stripe_payment_intent_id"), // For Stripe transactions
  description: text("description"), // What was purchased/topup reason
  metadata: jsonb("metadata"), // Additional transaction data
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Enhanced users table for Solar balance
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).unique(),
  solarBalance: integer("solar_balance").default(0), // Balance in Solar tokens
  totalEarned: integer("total_earned").default(0), // Total Solar earned
  totalSpent: integer("total_spent").default(0), // Total Solar spent
  registrationBonus: boolean("registration_bonus").default(false), // Has received bonus
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content library definitions
export const contentLibrary = pgTable("content_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentType: varchar("content_type").notNull(),
  contentId: varchar("content_id").notNull().unique(),
  title: varchar("title").notNull(),
  description: text("description"),
  previewDuration: integer("preview_duration"), // Preview time in seconds
  fullDuration: integer("full_duration"), // Full content duration
  solarCost: integer("solar_cost"), // Cost to unlock in Solar tokens
  timerDuration: integer("timer_duration"), // Timer duration for progression
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  metadata: jsonb("metadata"), // File paths, URLs, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertProgressionSchema = createInsertSchema(progressions);
export const insertEntitlementSchema = createInsertSchema(entitlements);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertUserProfileSchema = createInsertSchema(userProfiles);
export const insertContentLibrarySchema = createInsertSchema(contentLibrary);

// Select types for new tables
export type Progression = typeof progressions.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type ContentLibrary = typeof contentLibrary.$inferSelect;

// Insert types for new tables
export type InsertProgression = z.infer<typeof insertProgressionSchema>;
export type InsertEntitlement = z.infer<typeof insertEntitlementSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type InsertContentLibrary = z.infer<typeof insertContentLibrarySchema>;

// Members table - legacy member management system
export const members = pgTable("members", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: varchar("username").notNull().unique(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  joinedDate: timestamp("joined_date").defaultNow(),
  totalSolar: text("total_solar").default("0"),
  totalDollars: text("total_dollars").default("0"),
  isAnonymous: boolean("is_anonymous").default(false),
  isReserve: boolean("is_reserve").default(false),
  lastDistributionDate: timestamp("last_distribution_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Distribution logs for member payouts
export const distributionLogs = pgTable("distribution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: integer("member_id").references(() => members.id),
  distributionAmount: text("distribution_amount").notNull(),
  distributionType: varchar("distribution_type").notNull(), // 'monthly', 'annual', 'special'
  period: varchar("period"), // e.g., '2024-01', 'Q1-2024'
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"), // Additional distribution details
});

// Backup operation logs
export const backupLogs = pgTable("backup_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  backupType: varchar("backup_type").notNull(), // 'full', 'incremental', 'migration'
  status: varchar("status").notNull(), // 'started', 'completed', 'failed'
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  recordCount: integer("record_count"),
  timestamp: timestamp("timestamp").defaultNow(),
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional backup details
});

// Newsletter subscriptions
export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  status: varchar("status").default("active"), // 'active', 'unsubscribed', 'bounced'
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  source: varchar("source"), // Where they signed up from
  metadata: jsonb("metadata"), // Additional subscription data
});

// Contact messages
export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  subject: varchar("subject"),
  message: text("message").notNull(),
  status: varchar("status").default("new"), // 'new', 'read', 'replied', 'archived'
  createdAt: timestamp("created_at").defaultNow(),
  repliedAt: timestamp("replied_at"),
  metadata: jsonb("metadata"), // Additional message data
});

// Solar clock for global energy tracking
export const solarClock = pgTable("solar_clock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  kwh: text("kwh").notNull(), // Total kWh accumulated
  dollars: text("dollars").notNull(), // Total dollar value
  metadata: jsonb("metadata"), // Additional tracking data
});

// Products table for general product management
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  price: integer("price"), // Price in cents
  currency: varchar("currency").default("USD"),
  category: varchar("category"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"), // Additional product data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for additional tables
export const insertMemberSchema = createInsertSchema(members).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDistributionLogSchema = createInsertSchema(distributionLogs).omit({ id: true, timestamp: true });
export const insertBackupLogSchema = createInsertSchema(backupLogs).omit({ id: true, timestamp: true });
export const insertNewsletterSubscriptionSchema = createInsertSchema(newsletterSubscriptions).omit({ id: true, subscribedAt: true });
export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true });
export const insertSolarClockSchema = createInsertSchema(solarClock).omit({ id: true, timestamp: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });

// Select types for additional tables
export type Member = typeof members.$inferSelect;
export type DistributionLog = typeof distributionLogs.$inferSelect;
export type BackupLog = typeof backupLogs.$inferSelect;
export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type SolarClock = typeof solarClock.$inferSelect;
export type Product = typeof products.$inferSelect;

// Insert types for additional tables
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type InsertDistributionLog = z.infer<typeof insertDistributionLogSchema>;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;
export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSubscriptionSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type InsertSolarClock = z.infer<typeof insertSolarClockSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;