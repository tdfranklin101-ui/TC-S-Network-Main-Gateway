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

// Songs table for tracking music catalog
export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  artist: varchar("artist"),
  genre: varchar("genre"),
  filePath: varchar("file_path"), // Path to the music file
  duration: integer("duration"), // Duration in seconds
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: jsonb("metadata"), // Additional song info (credits, etc.)
});

// Play Events table for tracking song plays
export const playEvents = pgTable("play_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").references(() => songs.id).notNull(),
  sessionId: varchar("session_id"), // Optional session tracking
  userAgent: varchar("user_agent"),
  ipAddress: varchar("ip_address"),
  playedAt: timestamp("played_at").defaultNow(),
  playDuration: integer("play_duration"), // How long they listened (seconds)
  completedPlay: boolean("completed_play").default(false), // Did they finish the song?
  source: varchar("source").default('web'), // 'web', 'mobile', 'api', etc.
  metadata: jsonb("metadata"), // Additional tracking data
});

// Index for faster queries
export const songsTitleIndex = index("songs_title_idx").on(songs.title);
export const playEventsSongIndex = index("play_events_song_idx").on(playEvents.songId);
export const playEventsDateIndex = index("play_events_date_idx").on(playEvents.playedAt);

// Insert schemas
export const insertSongSchema = createInsertSchema(songs);
export const insertPlayEventSchema = createInsertSchema(playEvents);

// Select types
export type Song = typeof songs.$inferSelect;
export type PlayEvent = typeof playEvents.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type InsertPlayEvent = z.infer<typeof insertPlayEventSchema>;

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
  username: varchar("username").unique(),
  password: varchar("password"),
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
  purchaseMethod: varchar("purchase_method"), // 'solar', 'free', 'registration'
  solarCost: integer("solar_cost"), // Cost in Solar tokens
  expiresAt: timestamp("expires_at"), // For temporary access
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction log for Solar payments and Stripe top-ups
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'solar_spend', 'solar_earn', 'registration_bonus'
  amount: integer("amount").notNull(), // Amount in Solar tokens (for spend) or cents (for Stripe)
  currency: varchar("currency").default('SOLAR'), // 'SOLAR' or 'USD'
  status: varchar("status").notNull(), // 'pending', 'completed', 'failed', 'refunded'
  stripePaymentIntentId: varchar("stripe_payment_intent_id"), // Legacy field - no longer used
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

// Digital Artifacts for marketplace
export const artifacts = pgTable("artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  fileType: text("file_type").notNull(),
  kwhFootprint: varchar("kwh_footprint").notNull(),
  solarAmountS: varchar("solar_amount_s").notNull(),
  raysAmount: integer("rays_amount").default(0),
  spotifyComparisonPrice: text("spotify_comparison_price"),
  deliveryMode: text("delivery_mode").notNull(),
  deliveryUrl: text("delivery_url"), // Legacy field - kept for compatibility
  isBonus: boolean("is_bonus").default(false),
  creatorId: text("creator_id").notNull(),
  coverArtUrl: text("cover_art_url"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  // Enhanced three-copy file management system
  masterFileUrl: text("master_file_url"), // Original uploaded file (secure private storage)
  previewFileUrl: text("preview_file_url"), // Optimized preview version (thumbnails, clips, samples)
  tradeFileUrl: text("trade_file_url"), // File delivered to purchasers
  masterFileSize: integer("master_file_size"), // File size in bytes
  previewFileSize: integer("preview_file_size"), // Preview file size
  tradeFileSize: integer("trade_file_size"), // Trade file size
  fileDuration: integer("file_duration"), // Duration in seconds (for video/audio)
  previewDuration: integer("preview_duration"), // Preview clip duration
  // Preview system fields
  streamingUrl: text("streaming_url"), // Music Now streaming location
  previewType: text("preview_type"), // 'audio', 'video', 'image', 'pdf', 'text', 'other'
  previewSlug: text("preview_slug"), // Slug for preview page
  searchTags: text("search_tags").array(), // Tags for search indexing
  // Processing status
  processingStatus: text("processing_status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  processingError: text("processing_error"), // Error message if processing fails
});

// Insert types for additional tables
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type InsertDistributionLog = z.infer<typeof insertDistributionLogSchema>;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;
export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSubscriptionSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type InsertSolarClock = z.infer<typeof insertSolarClockSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Secure download tokens for purchased artifacts
export const downloadTokens = pgTable("download_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(), // Secure download token
  artifactId: varchar("artifact_id").references(() => artifacts.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  createdAt: timestamp("created_at").defaultNow(),
  
  // Enhanced secure access fields
  secureUrl: text("secure_url"), // Generated secure URL for file access
  accessType: varchar("access_type").default("trade_file"), // 'preview', 'trade_file', 'master_file'
  fileSize: bigint("file_size", { mode: "number" }), // File size for bandwidth tracking
  downloadCount: integer("download_count").default(0), // Track download attempts
  maxDownloads: integer("max_downloads").default(10), // Download limit
  lastAccessedAt: timestamp("last_accessed_at"), // Last download time
  ipAddress: varchar("ip_address"), // IP address for security tracking
  userAgent: text("user_agent"), // Browser/client info
  isRevoked: boolean("is_revoked").default(false), // Manual revocation flag
});

// Secure file access logs for audit trail
export const fileAccessLogs = pgTable("file_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").references(() => downloadTokens.id),
  artifactId: varchar("artifact_id").references(() => artifacts.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  accessType: varchar("access_type").notNull(), // 'preview', 'download', 'stream'
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  accessedAt: timestamp("accessed_at").defaultNow(),
  success: boolean("success").default(true), // Whether access was successful
  errorMessage: text("error_message"), // Error details if failed
  fileSize: bigint("file_size", { mode: "number" }), // Bytes transferred
  duration: integer("duration"), // Access duration in milliseconds
});

// Artifacts schemas
export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true });
export const insertDownloadTokenSchema = createInsertSchema(downloadTokens).omit({ id: true, createdAt: true });
export const insertFileAccessLogSchema = createInsertSchema(fileAccessLogs).omit({ id: true, accessedAt: true });

export type Artifact = typeof artifacts.$inferSelect;
export type DownloadToken = typeof downloadTokens.$inferSelect;
export type FileAccessLog = typeof fileAccessLogs.$inferSelect;

export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type InsertDownloadToken = z.infer<typeof insertDownloadTokenSchema>;
export type InsertFileAccessLog = z.infer<typeof insertFileAccessLogSchema>;