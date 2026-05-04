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
  numeric,
  date,
  doublePrecision,
  serial,
  bigint,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

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
}, (table) => ({
  titleIdx: index("songs_title_idx").on(table.title),
}));

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
}, (table) => ({
  songIdx: index("play_events_song_idx").on(table.songId),
  dateIdx: index("play_events_date_idx").on(table.playedAt),
}));

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

// Registrants table - waitlist registrations
export const registrants = pgTable("registrants", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  email: text("email").notNull(),
  name: text("name"),
  interests: text("interests"),
  registeredAt: timestamp("registered_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertRegistrantSchema = createInsertSchema(registrants).omit({ id: true });
export type Registrant = typeof registrants.$inferSelect;
export type InsertRegistrant = z.infer<typeof insertRegistrantSchema>;

// Wallets table - member wallet system
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  email: text("email").unique(),
  passcodeHash: text("passcode_hash"),
  balanceSolarS: numeric("balance_solar_s").default("0"),
  balanceRays: integer("balance_rays").default(0),
  promptCredits: integer("prompt_credits").default(0), // Gumball Machine pull credits
  lastDailyGrantAt: timestamp("last_daily_grant_at"),
  birthdate: timestamp("birthdate"),
  worldIdVerified: boolean("world_id_verified").default(false),
  worldIdNullifierHash: text("world_id_nullifier_hash"),
  worldIdVerificationLevel: text("world_id_verification_level"),
  worldIdVerifiedAt: timestamp("world_id_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Members table - legacy member management system
export const members = pgTable("members", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  joinedDate: text("joined_date").default(sql`CURRENT_TIMESTAMP`),
  totalSolar: numeric("total_solar").notNull().default("1"),
  totalDollars: numeric("total_dollars").notNull().default("0"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  isReserve: boolean("is_reserve").notNull().default(false),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  lastDistributionDate: text("last_distribution_date").default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
  signupTimestamp: timestamp("signup_timestamp").defaultNow(),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  walletId: varchar("wallet_id").$type<string>().unique().references(() => wallets.id, { onDelete: "set null" }),
  isAgent: boolean("is_agent").default(false),
  apiKey: text("api_key").unique(),
  isExternalAgent: boolean("is_external_agent").default(false),
  agentPlatform: text("agent_platform"),
  agentDescription: text("agent_description"),
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

// Solar Minting Ledger - tracks global Solar minting (8.5B/day) and member distributions
export const solarMintingLedger = pgTable("solar_minting_ledger", {
  id: serial("id").primaryKey(),
  ledgerDate: varchar("ledger_date", { length: 10 }).notNull().unique(),
  globalSolarMinted: numeric("global_solar_minted").notNull(),
  cumulativeSolarMinted: numeric("cumulative_solar_minted").notNull(),
  globalKwhGenerated: numeric("global_kwh_generated").notNull(),
  cumulativeKwhGenerated: numeric("cumulative_kwh_generated").notNull(),
  membersDistributed: integer("members_distributed").default(0),
  memberSolarDistributed: numeric("member_solar_distributed").default("0"),
  cumulativeMemberDistributed: numeric("cumulative_member_distributed").default("0"),
  daysSinceGenesis: integer("days_since_genesis").notNull(),
  solarPerSecond: numeric("solar_per_second").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

// Update log for system updates
export const updateLog = pgTable("update_log", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().default(sql`now()`),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull(),
  updated: jsonb("updated"),
  missing: jsonb("missing"),
  error: text("error"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  startedAtIdx: index("idx_update_log_started_at").on(table.startedAt),
}));

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
export const insertMemberSchema = createInsertSchema(members).omit({ id: true, signupTimestamp: true });
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
export type Wallet = typeof wallets.$inferSelect;
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
  lifeLensAnalysis: jsonb("lifelens_analysis"), // LifeLens × Rob Low needs analysis stored at creation
  productPrompt: text("product_prompt"), // AI prompt that can regenerate/represent what this artifact is
  subcategory: text("subcategory"), // Original creative category name preserved as subcategory
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
  artifactId: varchar("artifact_id").notNull(), // References artifacts.id (UUID)
  userId: integer("user_id").notNull(), // References users.id (INTEGER)
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  createdAt: timestamp("created_at").defaultNow(),
  
  // Enhanced secure access fields
  secureUrl: text("secure_url"), // Generated secure URL for file access
  accessType: varchar("access_type").default("trade_file"), // 'preview', 'trade_file', 'master_file'
  fileSize: integer("file_size"), // File size for bandwidth tracking
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
  fileSize: integer("file_size"), // Bytes transferred
  duration: integer("duration"), // Access duration in milliseconds
});

// Share tokens for artifact sharing
export const shareTokens = pgTable("share_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(),
  artifactId: varchar("artifact_id").references(() => artifacts.id).notNull(),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Identify Anything AI submissions
export const identifySubmissions = pgTable("identify_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt"),
  aiResponse: text("ai_response"),
  confidence: integer("confidence"),
  tags: text("tags").array(),
  processingStatus: varchar("processing_status").default("pending"),
  processingError: text("processing_error"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ============================================================
// ARTIFACT COPIES - Ownership tracking for purchased artifacts
// Implements "create and copy" protocol: creator retains original,
// buyer receives a copy with full access to trade file
// ============================================================
export const artifactCopies = pgTable("artifact_copies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id").notNull(), // References artifacts.id (UUID)
  ownerId: integer("owner_id").notNull(), // References users.id (INTEGER)
  purchaseTransactionId: varchar("purchase_transaction_id"), // References the purchase transaction
  copyNumber: integer("copy_number").default(1), // For limited editions
  acquiredAt: timestamp("acquired_at").defaultNow(),
  acquiredMethod: varchar("acquired_method").notNull().default("purchase"), // 'purchase', 'gift', 'airdrop', 'creator_mint'
  solarPaid: numeric("solar_paid"), // Amount paid in Solar
  isActive: boolean("is_active").default(true), // Can be revoked
  metadata: jsonb("metadata"), // Additional copy-specific data
}, (table) => ({
  ownerIdx: index("artifact_copies_owner_idx").on(table.ownerId),
  artifactIdx: index("artifact_copies_artifact_idx").on(table.artifactId),
}));

// ============================================================
// MARKETPLACE LEDGER - Double-entry Solar accounting
// Every Solar movement creates a debit and credit entry
// ============================================================
export const marketplaceLedger = pgTable("marketplace_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(), // Groups debit/credit pair
  entryType: varchar("entry_type").notNull(), // 'debit' or 'credit'
  accountId: varchar("account_id").notNull(), // User ID or special account (FOUNDATION, FEES)
  accountType: varchar("account_type").notNull(), // 'user', 'foundation', 'fees', 'creator'
  amount: numeric("amount").notNull(), // Solar amount (always positive)
  balanceAfter: numeric("balance_after"), // Account balance after this entry
  referenceType: varchar("reference_type").notNull(), // 'purchase', 'grant', 'transfer', 'fee'
  referenceId: varchar("reference_id"), // artifact_id, copy_id, etc.
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  transactionIdx: index("ledger_transaction_idx").on(table.transactionId),
  accountIdx: index("ledger_account_idx").on(table.accountId),
  dateIdx: index("ledger_date_idx").on(table.createdAt),
}));

// Artifacts schemas
export const insertArtifactSchema = createInsertSchema(artifacts).omit({ id: true, createdAt: true });
export const insertDownloadTokenSchema = createInsertSchema(downloadTokens);
export const insertFileAccessLogSchema = createInsertSchema(fileAccessLogs);
export const insertShareTokenSchema = createInsertSchema(shareTokens);
export const insertIdentifySubmissionSchema = createInsertSchema(identifySubmissions);
export const insertArtifactCopySchema = createInsertSchema(artifactCopies).omit({ id: true, acquiredAt: true });
export const insertMarketplaceLedgerSchema = createInsertSchema(marketplaceLedger).omit({ id: true, createdAt: true });

export type Artifact = typeof artifacts.$inferSelect;
export type DownloadToken = typeof downloadTokens.$inferSelect;
export type FileAccessLog = typeof fileAccessLogs.$inferSelect;
export type ShareToken = typeof shareTokens.$inferSelect;
export type IdentifySubmission = typeof identifySubmissions.$inferSelect;
export type ArtifactCopy = typeof artifactCopies.$inferSelect;
export type MarketplaceLedgerEntry = typeof marketplaceLedger.$inferSelect;

export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type InsertDownloadToken = z.infer<typeof insertDownloadTokenSchema>;
export type InsertFileAccessLog = z.infer<typeof insertFileAccessLogSchema>;
export type InsertShareToken = z.infer<typeof insertShareTokenSchema>;
export type InsertIdentifySubmission = z.infer<typeof insertIdentifySubmissionSchema>;
export type InsertArtifactCopy = z.infer<typeof insertArtifactCopySchema>;
export type InsertMarketplaceLedgerEntry = z.infer<typeof insertMarketplaceLedgerSchema>;

// Geographic Analytics - Privacy-focused aggregate daily visit tracking (production only)
export const geoAnalytics = pgTable("geo_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(), // Format: 'YYYY-MM-DD' (e.g., '2025-04-07')
  environment: varchar("environment", { length: 20 }).notNull().default('production'), // 'production' or 'development'
  countryCode: varchar("country_code", { length: 2 }).notNull(), // ISO 3166-1 alpha-2 (e.g., 'US', 'CA')
  countryName: varchar("country_name").notNull(), // Full country name
  stateCode: varchar("state_code", { length: 2 }), // US state code (e.g., 'CA', 'NY') - NULL for non-US
  stateName: varchar("state_name"), // US state name - NULL for non-US
  visitCount: integer("visit_count").default(0).notNull(), // Aggregate visit count
  updatedAt: timestamp("updated_at").defaultNow(), // Last update timestamp
});

// Indexes for fast queries by date and location will be created separately

// Insert schema
export const insertGeoAnalyticsSchema = createInsertSchema(geoAnalytics).omit({ id: true, updatedAt: true });

// Select and insert types
export type GeoAnalytics = typeof geoAnalytics.$inferSelect;
export type InsertGeoAnalytics = z.infer<typeof insertGeoAnalyticsSchema>;

// UIM Handshake Protocol - AI-to-AI interaction tracking
export const uimHandshakes = pgTable("uim_handshakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeId: varchar("node_id").notNull(), // Local node identifier (tcs-network-foundation-001)
  systemId: varchar("system_id").notNull(), // Connecting AI system ID (chatgpt, claude, gemini, etc.)
  systemName: varchar("system_name").notNull(), // Human-readable system name
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  signature: varchar("signature").notNull(), // SHA-256 cryptographic signature
  energyKwh: varchar("energy_kwh").notNull(), // Energy consumed in kWh
  solarEquivalent: varchar("solar_equivalent").notNull(), // Converted Solar units
  renewableSource: varchar("renewable_source").notNull(), // SOLAR, WIND, or HYDRO
  ethicsScore: integer("ethics_score").notNull(), // 0-100 ethics compliance score
  capabilities: text("capabilities").array(), // System capabilities array
  status: varchar("status").notNull().default("completed"), // completed, failed, pending
  routedTo: varchar("routed_to"), // System this query was routed to (if applicable)
  metadata: jsonb("metadata"), // Additional handshake context
}, (table) => ({
  systemIdx: index("uim_handshakes_system_idx").on(table.systemId),
  timestampIdx: index("uim_handshakes_timestamp_idx").on(table.timestamp),
}));

// Insert schema
export const insertUimHandshakeSchema = createInsertSchema(uimHandshakes).omit({ id: true, timestamp: true });

// Select and insert types
export type UimHandshake = typeof uimHandshakes.$inferSelect;
export type InsertUimHandshake = z.infer<typeof insertUimHandshakeSchema>;

// ============================================================
// SOLAR INTELLIGENCE AUDIT LAYER (SAi-Audit)
// Regulatory-grade energy demand tracking with full lineage
// ============================================================

// 1️⃣ Energy Categories
export const solarAuditCategories = pgTable("solar_audit_categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2️⃣ Data Sources (auditors, APIs, metered systems)
export const solarAuditDataSources = pgTable("solar_audit_data_sources", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  organization: text("organization"),
  contact: text("contact"),
  verificationLevel: varchar("verification_level", { length: 20 }).notNull(), // SELF, THIRD_PARTY, METERED, MODELLED
  sourceType: text("source_type").default('DIRECT'), // DIRECT or AGGREGATOR
  uri: text("uri"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3️⃣ Auditable Energy Entries (the core ledger)
export const solarAuditEntries = pgTable("solar_audit_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: integer("category_id").references(() => solarAuditCategories.id).notNull(),
  sourceId: integer("source_id").references(() => solarAuditDataSources.id).notNull(),
  day: date("day").notNull(),
  kwh: numeric("kwh", { precision: 18, scale: 3 }).notNull(),
  solarUnits: numeric("solar_units", { precision: 18, scale: 6 }), // Will be computed: kwh / 4913.0
  rightsAlignment: jsonb("rights_alignment"), // {"privacy":"ENFORCED", "transparency":"PUBLIC"}
  dataHash: text("data_hash"), // SHA256 of raw entry for immutability
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  dayIdx: index("solar_audit_entries_day_idx").on(table.day),
  categoryIdx: index("solar_audit_entries_category_idx").on(table.categoryId),
  sourceIdx: index("solar_audit_entries_source_idx").on(table.sourceId),
}));

// Insert schemas
export const insertSolarAuditCategorySchema = createInsertSchema(solarAuditCategories).omit({ id: true, createdAt: true });
export const insertSolarAuditDataSourceSchema = createInsertSchema(solarAuditDataSources).omit({ id: true, createdAt: true });
export const insertSolarAuditEntrySchema = createInsertSchema(solarAuditEntries).omit({ id: true, createdAt: true });

// Select types
export type SolarAuditCategory = typeof solarAuditCategories.$inferSelect;
export type SolarAuditDataSource = typeof solarAuditDataSources.$inferSelect;
export type SolarAuditEntry = typeof solarAuditEntries.$inferSelect;

// Insert types
export type InsertSolarAuditCategory = z.infer<typeof insertSolarAuditCategorySchema>;
export type InsertSolarAuditDataSource = z.infer<typeof insertSolarAuditDataSourceSchema>;
export type InsertSolarAuditEntry = z.infer<typeof insertSolarAuditEntrySchema>;

// ============================================================
// REGIONAL ENERGY BREAKDOWN SYSTEM (Phase 2 - Hierarchical Global)
// Track energy consumption by geographic regions with 2-level hierarchy
// Level 1: 6 Global Regions (Asia, North America, Europe, Africa, Latin America, Oceania)
// Level 2: US Census Sub-Regions (Northeast, Midwest, South, West) - children of North America
// ============================================================

// Regional taxonomy with hierarchical structure
export const auditRegions = pgTable('audit_regions', {
  code: varchar('code', { length: 50 }).primaryKey(), // e.g., 'GLOBAL_ASIA', 'US_NORTHEAST'
  name: text('name').notNull(), // e.g., 'Asia (Global Primary)', 'United States - Northeast'
  level: integer('level').notNull(), // 1 = global primary, 2 = sub-region
  parentRegion: varchar('parent_region', { length: 50 }), // e.g., US regions have parent='GLOBAL_NORTH_AMERICA'
  population: bigint('population', { mode: 'number' }), // Population for context (optional)
  color: varchar('color', { length: 50 }), // Hex color for visualizations
  metadata: jsonb('metadata') // {countries: [], states: [], description: '', etc.}
});

// Regional energy totals linked to audit log entries
// Note: audit_log_id references energy_audit_log.id (created via raw SQL in main.js, not Drizzle)
export const auditRegionTotals = pgTable('audit_region_totals', {
  id: serial('id').primaryKey(),
  auditLogId: integer('audit_log_id').notNull(), // References energy_audit_log.id (SERIAL PRIMARY KEY)
  regionCode: varchar('region_code', { length: 50 }).notNull().references(() => auditRegions.code),
  energyKwh: doublePrecision('energy_kwh').notNull(),
  energySolar: doublePrecision('energy_solar').notNull(),
  dataFreshness: varchar('data_freshness', { length: 20 }).default('LIVE_DAILY'), // LIVE_DAILY, QUARTERLY_API, ANNUAL_DATASET
  metadata: jsonb('metadata') // store region-specific details + source info
}, (table) => ({
  auditLogIdx: index('idx_region_totals_audit_log').on(table.auditLogId),
  regionIdx: index('idx_region_totals_region').on(table.regionCode),
}));

// Insert schemas
export const insertAuditRegionSchema = createInsertSchema(auditRegions);
export const insertAuditRegionTotalSchema = createInsertSchema(auditRegionTotals).omit({ id: true });

// Select types
export type AuditRegion = typeof auditRegions.$inferSelect;
export type AuditRegionTotal = typeof auditRegionTotals.$inferSelect;

// Insert types
export type InsertAuditRegion = z.infer<typeof insertAuditRegionSchema>;
export type InsertAuditRegionTotal = z.infer<typeof insertAuditRegionTotalSchema>;

// ============================================================
// DMTXACTLY AI Agent API - Agent Authentication & Generation Jobs
// ============================================================

export const agentApiKeys = pgTable("agent_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentName: text("agent_name").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  scopes: text("scopes").array(),
  memberId: integer("member_id").references(() => members.id),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
});

export const dmtxactlyJobs = pgTable("dmtxactly_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => agentApiKeys.id),
  memberId: integer("member_id").references(() => members.id),
  jobType: text("job_type").notNull(),
  patternType: text("pattern_type"),
  prompt: text("prompt"),
  parameters: jsonb("parameters"),
  status: text("status").default("pending"),
  resultImageUrl: text("result_image_url"),
  resultPreviewUrl: text("result_preview_url"),
  solarCost: numeric("solar_cost", { precision: 18, scale: 8 }),
  raysCost: integer("rays_cost"),
  wpcGrade: text("wpc_grade"),
  computeMetrics: jsonb("compute_metrics"),
  artifactId: varchar("artifact_id").references(() => artifacts.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// Insert schemas
export const insertAgentApiKeySchema = createInsertSchema(agentApiKeys).omit({ id: true, createdAt: true });
export const insertDmtxactlyJobSchema = createInsertSchema(dmtxactlyJobs).omit({ id: true, createdAt: true });

// Select types
export type AgentApiKey = typeof agentApiKeys.$inferSelect;
export type DmtxactlyJob = typeof dmtxactlyJobs.$inferSelect;

// Insert types
export type InsertAgentApiKey = z.infer<typeof insertAgentApiKeySchema>;
export type InsertDmtxactlyJob = z.infer<typeof insertDmtxactlyJobSchema>;

// ============================================================
// DIGITAL GUMBALL MACHINE - Prompt Gumball Vending System
// MCP-COMPILE Bundle: Rays-based pricing, off-site payments,
// job execution with manual delivery workflow
// ============================================================

// Gumball Products (pull bundles with Rays pricing)
export const gumballProducts = pgTable("gumball_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  pulls: integer("pulls").notNull(),
  priceRays: integer("price_rays").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Gumball Transactions (purchase records with checkout links)
export const gumballTransactions = pgTable("gumball_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: varchar("visitor_id").notNull(),
  productId: varchar("product_id").references(() => gumballProducts.id).notNull(),
  currency: varchar("currency").notNull(), // 'USD', 'BTC', 'SOLAR'
  status: varchar("status").notNull().default("pending"), // pending, confirmed, failed, refunded
  checkoutUrl: text("checkout_url"),
  priceRays: integer("price_rays").notNull(),
  pullsPurchased: integer("pulls_purchased").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => ({
  visitorIdx: index("gumball_transactions_visitor_idx").on(table.visitorId),
  statusIdx: index("gumball_transactions_status_idx").on(table.status),
}));

// Gumballs (vended prompt gumballs with remix options)
export const gumballs = pgTable("gumballs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: varchar("visitor_id").notNull(),
  title: text("title").notNull(),
  type: varchar("type").notNull(), // 'video', 'image', 'audio', etc.
  promptMain: text("prompt_main").notNull(),
  remixJson: jsonb("remix_json"), // Array of remix options
  mcpRunbook: jsonb("mcp_runbook"), // MCP execution runbook
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  visitorIdx: index("gumballs_visitor_idx").on(table.visitorId),
}));

// Gumball Jobs (execution pipeline: QUEUED → RUNNING → AWAITING_ASSET → DELIVERED)
export const gumballJobs = pgTable("gumball_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: varchar("visitor_id").notNull(),
  gumballId: varchar("gumball_id").references(() => gumballs.id).notNull(),
  status: varchar("status").notNull().default("QUEUED"), // QUEUED, RUNNING, AWAITING_ASSET, DELIVERED, FAILED
  provider: varchar("provider").default("SORA_MANUAL"), // SORA_MANUAL, PIKA, RUNWAY, etc.
  composedPrompt: text("composed_prompt"), // Base prompt + selected remix merged
  selectedRemixId: varchar("selected_remix_id"), // Which remix was selected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  visitorIdx: index("gumball_jobs_visitor_idx").on(table.visitorId),
  statusIdx: index("gumball_jobs_status_idx").on(table.status),
  gumballIdx: index("gumball_jobs_gumball_idx").on(table.gumballId),
}));

// Gumball Assets (delivered video/image assets)
export const gumballAssets = pgTable("gumball_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => gumballJobs.id).notNull(),
  kind: varchar("kind").notNull(), // 'video', 'thumbnail', 'preview', 'prompt_txt'
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  jobIdx: index("gumball_assets_job_idx").on(table.jobId),
}));

// Insert schemas
export const insertGumballProductSchema = createInsertSchema(gumballProducts).omit({ id: true, createdAt: true });
export const insertGumballTransactionSchema = createInsertSchema(gumballTransactions).omit({ id: true, createdAt: true });
export const insertGumballSchema = createInsertSchema(gumballs).omit({ id: true, createdAt: true });
export const insertGumballJobSchema = createInsertSchema(gumballJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGumballAssetSchema = createInsertSchema(gumballAssets).omit({ id: true, createdAt: true });

// Select types
export type GumballProduct = typeof gumballProducts.$inferSelect;
export type GumballTransaction = typeof gumballTransactions.$inferSelect;
export type Gumball = typeof gumballs.$inferSelect;
export type GumballJob = typeof gumballJobs.$inferSelect;
export type GumballAsset = typeof gumballAssets.$inferSelect;

// Insert types
export type InsertGumballProduct = z.infer<typeof insertGumballProductSchema>;
export type InsertGumballTransaction = z.infer<typeof insertGumballTransactionSchema>;
export type InsertGumball = z.infer<typeof insertGumballSchema>;
export type InsertGumballJob = z.infer<typeof insertGumballJobSchema>;
export type InsertGumballAsset = z.infer<typeof insertGumballAssetSchema>;

// ============================================
// MARKETPLACE SEARCH & PROCUREMENT SYSTEM
// ============================================

// Market Items - Products/services available in marketplace
export const marketItems = pgTable("market_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  category: varchar("category"),
  priceSolar: numeric("price_solar", { precision: 18, scale: 6 }),
  priceFiatOptional: numeric("price_fiat_optional", { precision: 10, scale: 2 }),
  kwhEstimate: numeric("kwh_estimate", { precision: 12, scale: 4 }),
  sourceType: varchar("source_type").notNull().default("INTERNAL_STOCK"), // INTERNAL_STOCK, EXTERNAL_FULFILLMENT
  sourceUrl: text("source_url"),
  vendorName: varchar("vendor_name"),
  status: varchar("status").notNull().default("DRAFT"), // DRAFT, ACTIVE, ARCHIVED
  searchText: text("search_text"), // Normalized for search indexing
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUserId: varchar("created_by_user_id"),
  metadata: jsonb("metadata"),
  subcategory: text("subcategory"), // Original creative category name preserved as subcategory
}, (table) => ({
  statusIdx: index("market_items_status_idx").on(table.status),
  categoryIdx: index("market_items_category_idx").on(table.category),
  searchIdx: index("market_items_search_idx").on(table.searchText),
}));

// Market Requests - User requests for items not found
export const marketRequests = pgTable("market_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  constraints: jsonb("constraints"), // { budget, condition, location, urgency }
  requestedByUserId: varchar("requested_by_user_id").notNull(),
  status: varchar("status").notNull().default("NEW"), // NEW, SCOUTING, REVIEW_READY, APPROVED, REJECTED, PUBLISHED
  resultCountAtRequestTime: integer("result_count_at_request_time").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("market_requests_status_idx").on(table.status),
  userIdx: index("market_requests_user_idx").on(table.requestedByUserId),
}));

// Procurement Recommendations - AI scout agent recommendations
export const procurementRecommendations = pgTable("procurement_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => marketRequests.id).notNull(),
  vendorName: varchar("vendor_name"),
  productTitle: text("product_title").notNull(),
  sourceUrl: text("source_url"),
  priceEstimateFiat: numeric("price_estimate_fiat", { precision: 10, scale: 2 }),
  shippingNotes: text("shipping_notes"),
  kwhEstimate: numeric("kwh_estimate", { precision: 12, scale: 4 }),
  fitScore: integer("fit_score"), // 0-100
  agentRationale: text("agent_rationale"),
  riskFlags: text("risk_flags").array(), // ['restricted', 'uncertain_match', etc.]
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  requestIdx: index("procurement_recs_request_idx").on(table.requestId),
}));

// Procurement Reviews - Human review decisions
export const procurementReviews = pgTable("procurement_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => marketRequests.id).notNull(),
  reviewerUserId: varchar("reviewer_user_id").notNull(),
  decision: varchar("decision").notNull(), // APPROVED, REJECTED, MORE_INFO_NEEDED
  notes: text("notes"),
  approvedRecId: varchar("approved_rec_id").references(() => procurementRecommendations.id),
  publishMode: varchar("publish_mode"), // FOUNDATION_STOCK, EXTERNAL_FULFILLMENT
  createdDraftItemId: varchar("created_draft_item_id").references(() => marketItems.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  requestIdx: index("procurement_reviews_request_idx").on(table.requestId),
}));

// Insert schemas
export const insertMarketItemSchema = createInsertSchema(marketItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketRequestSchema = createInsertSchema(marketRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProcurementRecommendationSchema = createInsertSchema(procurementRecommendations).omit({ id: true, createdAt: true });
export const insertProcurementReviewSchema = createInsertSchema(procurementReviews).omit({ id: true, createdAt: true });

// Select types
export type MarketItem = typeof marketItems.$inferSelect;
export type MarketRequest = typeof marketRequests.$inferSelect;
export type ProcurementRecommendation = typeof procurementRecommendations.$inferSelect;
export type ProcurementReview = typeof procurementReviews.$inferSelect;

// Insert types
export type InsertMarketItem = z.infer<typeof insertMarketItemSchema>;
export type InsertMarketRequest = z.infer<typeof insertMarketRequestSchema>;
export type InsertProcurementRecommendation = z.infer<typeof insertProcurementRecommendationSchema>;
export type InsertProcurementReview = z.infer<typeof insertProcurementReviewSchema>;

// ============================================================================
// MARKETPLACE OPERATIONS - Autonomy Spine v2
// Inventory, Orders, Settlement, Network Configuration
// ============================================================================

// Inventory tracking - quantity and reservations per asset
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  networkId: varchar("network_id"),
  quantityTotal: integer("quantity_total").notNull().default(1),
  quantityAvailable: integer("quantity_available").notNull().default(1),
  quantityReserved: integer("quantity_reserved").notNull().default(0),
  reorderThreshold: integer("reorder_threshold").default(0),
  warehouseLocation: varchar("warehouse_location"),
  lastRestockAt: timestamp("last_restock_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  assetIdx: index("inventory_asset_idx").on(table.assetId),
  networkIdx: index("inventory_network_idx").on(table.networkId),
}));

// Orders - buyer intent and lifecycle
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull(),
  networkId: varchar("network_id"),
  status: varchar("status").notNull().default("pending"),
  totalSolar: numeric("total_solar", { precision: 18, scale: 6 }),
  totalFiat: numeric("total_fiat", { precision: 10, scale: 2 }),
  currency: varchar("currency").default("usd"),
  paymentMethod: varchar("payment_method"),
  paymentIntentId: varchar("payment_intent_id"),
  paymentCapturedAt: timestamp("payment_captured_at"),
  fulfillmentStatus: varchar("fulfillment_status").default("pending"),
  fulfillmentMethod: varchar("fulfillment_method"),
  fulfilledAt: timestamp("fulfilled_at"),
  fulfilledBy: varchar("fulfilled_by"),
  verificationCode: varchar("verification_code"),
  pickupAddress: text("pickup_address"),
  shippingAddress: jsonb("shipping_address"),
  notes: text("notes"),
  reservationExpiresAt: timestamp("reservation_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  buyerIdx: index("orders_buyer_idx").on(table.buyerId),
  statusIdx: index("orders_status_idx").on(table.status),
  networkIdx: index("orders_network_idx").on(table.networkId),
  createdIdx: index("orders_created_idx").on(table.createdAt),
}));

// Order items - individual line items in an order
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  assetId: varchar("asset_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceSolar: numeric("unit_price_solar", { precision: 18, scale: 6 }),
  unitPriceFiat: numeric("unit_price_fiat", { precision: 10, scale: 2 }),
  totalPriceSolar: numeric("total_price_solar", { precision: 18, scale: 6 }),
  totalPriceFiat: numeric("total_price_fiat", { precision: 10, scale: 2 }),
  vendorId: varchar("vendor_id"),
  feeBreakdown: jsonb("fee_breakdown"),
  status: varchar("status").default("reserved"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  orderIdx: index("order_items_order_idx").on(table.orderId),
  assetIdx: index("order_items_asset_idx").on(table.assetId),
}));

// Ledger events - immutable transaction log (append-only)
export const ledgerEvents = pgTable("ledger_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(),
  orderId: varchar("order_id"),
  orderItemId: varchar("order_item_id"),
  settlementId: varchar("settlement_id"),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: varchar("currency").notNull().default("solar"),
  fromAccountId: varchar("from_account_id"),
  toAccountId: varchar("to_account_id"),
  fromAccountType: varchar("from_account_type"),
  toAccountType: varchar("to_account_type"),
  description: text("description"),
  networkId: varchar("network_id"),
  actionRequestId: varchar("action_request_id"),
  postedAt: timestamp("posted_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  orderIdx: index("ledger_events_order_idx").on(table.orderId),
  settlementIdx: index("ledger_events_settlement_idx").on(table.settlementId),
  eventTypeIdx: index("ledger_events_type_idx").on(table.eventType),
  postedIdx: index("ledger_events_posted_idx").on(table.postedAt),
}));

// Settlements - periodic fund distribution runs
export const settlements = pgTable("settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  networkId: varchar("network_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: varchar("status").notNull().default("pending"),
  ordersSettled: integer("orders_settled").default(0),
  totalVolumeSolar: numeric("total_volume_solar", { precision: 18, scale: 6 }),
  totalVolumeFiat: numeric("total_volume_fiat", { precision: 10, scale: 2 }),
  vendorPayouts: numeric("vendor_payouts", { precision: 18, scale: 6 }),
  commissionerFees: numeric("commissioner_fees", { precision: 18, scale: 6 }),
  tcsFees: numeric("tcs_fees", { precision: 18, scale: 6 }),
  taxBucket: numeric("tax_bucket", { precision: 18, scale: 6 }),
  microFees: numeric("micro_fees", { precision: 18, scale: 6 }),
  actionRequestId: varchar("action_request_id"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  networkIdx: index("settlements_network_idx").on(table.networkId),
  statusIdx: index("settlements_status_idx").on(table.status),
  periodIdx: index("settlements_period_idx").on(table.periodStart, table.periodEnd),
}));

// Intent Log - audit trail for privileged operations
export const intentLog = pgTable("intent_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow(),
  who: varchar("who").notNull(),
  role: varchar("role"),
  actionType: varchar("action_type"),
  route: varchar("route"),
  method: varchar("method"),
  reqId: varchar("req_id"),
  payloadHash: varchar("payload_hash"),
  ip: varchar("ip"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
  error: text("error"),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata"),
}, (table) => ({
  timestampIdx: index("intent_log_timestamp_idx").on(table.timestamp),
  whoIdx: index("intent_log_who_idx").on(table.who),
  actionTypeIdx: index("intent_log_action_type_idx").on(table.actionType),
  reqIdIdx: index("intent_log_req_id_idx").on(table.reqId),
}));

// Scheduled Jobs - for daily schedulers
export const scheduledJobs = pgTable("scheduled_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobType: varchar("job_type").notNull(),
  schedule: varchar("schedule").notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  status: varchar("status").default("pending"),
  networkId: varchar("network_id"),
  config: jsonb("config"),
  lastResult: jsonb("last_result"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobTypeIdx: index("scheduled_jobs_type_idx").on(table.jobType),
  nextRunIdx: index("scheduled_jobs_next_run_idx").on(table.nextRunAt),
  statusIdx: index("scheduled_jobs_status_idx").on(table.status),
}));

// Network configuration - pricing rules, fee splits, constraints
export const networkConfig = pgTable("network_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  networkId: varchar("network_id").notNull(),
  configKey: varchar("config_key").notNull(),
  configValue: jsonb("config_value").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
}, (table) => ({
  networkKeyIdx: index("network_config_network_key_idx").on(table.networkId, table.configKey),
  activeIdx: index("network_config_active_idx").on(table.isActive),
}));

// Default network pricing configuration
export const DEFAULT_PRICING_CONFIG = {
  commissionerMargin: 0.10,
  tcsMargin: 0.02,
  taxRate: 0.08,
  microFeePerTransaction: 0.001,
  taxIncluded: true,
  categoryFloors: {},
  categoryCeilings: {},
  allowedCategories: ['computronium', 'culture', 'basic_needs', 'energy_trading', 'services'],
  autoListThresholds: {
    maxRiskScore: 20,
    minConfidence: 80,
    maxPriceDeviation: 0.15
  }
};

// Insert schemas for new tables
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true, createdAt: true });
export const insertLedgerEventSchema = createInsertSchema(ledgerEvents).omit({ id: true, postedAt: true });
export const insertSettlementSchema = createInsertSchema(settlements).omit({ id: true, createdAt: true });
export const insertNetworkConfigSchema = createInsertSchema(networkConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIntentLogSchema = createInsertSchema(intentLog).omit({ id: true, timestamp: true });
export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({ id: true, createdAt: true, updatedAt: true });

// Select types for new tables
export type Inventory = typeof inventory.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type NetworkConfig = typeof networkConfig.$inferSelect;
export type IntentLog = typeof intentLog.$inferSelect;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

// Insert types for new tables
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertLedgerEvent = z.infer<typeof insertLedgerEventSchema>;
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type InsertNetworkConfig = z.infer<typeof insertNetworkConfigSchema>;
export type InsertIntentLog = z.infer<typeof insertIntentLogSchema>;
export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;

// Order status enum
export const ORDER_STATUS = {
  PENDING: 'pending',
  RESERVED: 'reserved',
  PAYMENT_PENDING: 'payment_pending',
  PAID: 'paid',
  FULFILLING: 'fulfilling',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed'
} as const;

// Ledger event types
export const LEDGER_EVENT_TYPE = {
  SALE: 'sale',
  REFUND: 'refund',
  FEE_COMMISSIONER: 'fee_commissioner',
  FEE_TCS: 'fee_tcs',
  FEE_MICRO: 'fee_micro',
  TAX: 'tax',
  SETTLEMENT_VENDOR: 'settlement_vendor',
  SETTLEMENT_COMMISSIONER: 'settlement_commissioner',
  SETTLEMENT_TCS: 'settlement_tcs',
  SETTLEMENT_TAX: 'settlement_tax',
  ADJUSTMENT: 'adjustment'
} as const;

// ============================================================================
// AGENTIC FRAMEWORK TABLES
// Policy-gated action system for autonomous agents
// ============================================================================

// Action status enum values
export const ACTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

// Risk level enum values
export const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

// Action Requests - core table for policy-gated agent actions
export const actionRequests = pgTable("action_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actionType: varchar("action_type").notNull(),
  agentId: varchar("agent_id").notNull(),
  agentName: varchar("agent_name"),
  requesterId: varchar("requester_id"),
  riskLevel: varchar("risk_level").notNull().default('low'),
  status: varchar("status").notNull().default('pending'),
  payload: jsonb("payload").notNull(),
  validationResult: jsonb("validation_result"),
  policyChecks: jsonb("policy_checks"),
  executionResult: jsonb("execution_result"),
  errorMessage: text("error_message"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata")
}, (table) => ({
  statusIdx: index("action_requests_status_idx").on(table.status),
  agentIdx: index("action_requests_agent_idx").on(table.agentId),
  typeIdx: index("action_requests_type_idx").on(table.actionType),
  createdIdx: index("action_requests_created_idx").on(table.createdAt)
}));

// Agent Registry - registered agents and their permissions
export const agentRegistry = pgTable("agent_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentName: varchar("agent_name").notNull().unique(),
  agentType: varchar("agent_type").notNull(),
  description: text("description"),
  allowedActions: jsonb("allowed_actions").notNull().default(sql`'[]'::jsonb`),
  maxRiskLevel: varchar("max_risk_level").notNull().default('low'),
  rateLimit: integer("rate_limit").default(100),
  rateLimitWindow: integer("rate_limit_window").default(3600),
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  metadata: jsonb("metadata")
}, (table) => ({
  nameIdx: index("agent_registry_name_idx").on(table.agentName),
  typeIdx: index("agent_registry_type_idx").on(table.agentType)
}));

// Policy Rules - deterministic rules for action validation
export const policyRules = pgTable("policy_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleName: varchar("rule_name").notNull().unique(),
  ruleType: varchar("rule_type").notNull(),
  actionTypes: jsonb("action_types").notNull().default(sql`'[]'::jsonb`),
  conditions: jsonb("conditions").notNull(),
  priority: integer("priority").default(100),
  isActive: boolean("is_active").default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  ruleNameIdx: index("policy_rules_name_idx").on(table.ruleName),
  priorityIdx: index("policy_rules_priority_idx").on(table.priority)
}));

// Network Specifications - for Commissioning Agent
export const networkSpecs = pgTable("network_specs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  networkType: varchar("network_type").notNull(),
  capabilities: jsonb("capabilities").notNull().default(sql`'[]'::jsonb`),
  region: varchar("region").default('global'),
  energySource: varchar("energy_source"),
  status: varchar("status").notNull().default('draft'),
  actionRequestId: varchar("action_request_id").references(() => actionRequests.id),
  createdByAgentId: varchar("created_by_agent_id"),
  initialSolarAllocation: numeric("initial_solar_allocation").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  activatedAt: timestamp("activated_at"),
  metadata: jsonb("metadata")
}, (table) => ({
  nameIdx: index("network_specs_name_idx").on(table.name),
  statusIdx: index("network_specs_status_idx").on(table.status)
}));

// Action Audit Log - immutable log of all actions
export const actionAuditLog = pgTable("action_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actionRequestId: varchar("action_request_id").references(() => actionRequests.id),
  eventType: varchar("event_type").notNull(),
  eventData: jsonb("event_data"),
  agentId: varchar("agent_id"),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent")
}, (table) => ({
  actionIdx: index("action_audit_log_action_idx").on(table.actionRequestId),
  timestampIdx: index("action_audit_log_timestamp_idx").on(table.timestamp)
}));

// Insert schemas for agentic framework
export const insertActionRequestSchema = createInsertSchema(actionRequests).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertAgentRegistrySchema = createInsertSchema(agentRegistry).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertPolicyRuleSchema = createInsertSchema(policyRules).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertNetworkSpecSchema = createInsertSchema(networkSpecs).omit({ 
  id: true, createdAt: true 
});
export const insertActionAuditLogSchema = createInsertSchema(actionAuditLog).omit({ 
  id: true, timestamp: true 
});

// Select types for agentic framework
export type ActionRequest = typeof actionRequests.$inferSelect;
export type AgentRegistryEntry = typeof agentRegistry.$inferSelect;
export type PolicyRule = typeof policyRules.$inferSelect;
export type NetworkSpec = typeof networkSpecs.$inferSelect;
export type ActionAuditLogEntry = typeof actionAuditLog.$inferSelect;

// Insert types for agentic framework
export type InsertActionRequest = z.infer<typeof insertActionRequestSchema>;
export type InsertAgentRegistry = z.infer<typeof insertAgentRegistrySchema>;
export type InsertPolicyRule = z.infer<typeof insertPolicyRuleSchema>;
export type InsertNetworkSpec = z.infer<typeof insertNetworkSpecSchema>;
export type InsertActionAuditLog = z.infer<typeof insertActionAuditLogSchema>;

// ============================================================================
// TC-S VOUCHER MODULE - Alternative Request Fulfillment System
// Vouchers for physical goods, services, admissions, experiences, rentals
// ============================================================================

// Voucher Listings - What vendors create/sell
export const voucherListings = pgTable("voucher_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull(),
  listingId: varchar("listing_id"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  voucherType: varchar("voucher_type").notNull(), // goods_pickup, service, admission, experience, rental, subscription
  priceRays: integer("price_rays").notNull(),
  energyKwh: numeric("energy_kwh", { precision: 10, scale: 4 }),
  quantityAvailable: integer("quantity_available"),
  quantitySold: integer("quantity_sold").default(0),
  redemptionLocation: text("redemption_location"),
  redemptionInstructions: text("redemption_instructions"),
  redemptionHours: varchar("redemption_hours", { length: 500 }),
  redemptionMethod: varchar("redemption_method").default("qr_code"), // qr_code, voucher_code, nfc, biometric
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  redemptionWindowHours: integer("redemption_window_hours"),
  termsConditions: text("terms_conditions"),
  refundPolicy: text("refund_policy"),
  transferable: boolean("transferable").default(false),
  category: varchar("category", { length: 100 }),
  tags: jsonb("tags"),
  images: jsonb("images"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  vendorIdx: index("voucher_listings_vendor_idx").on(table.vendorId),
  typeIdx: index("voucher_listings_type_idx").on(table.voucherType),
  activeIdx: index("voucher_listings_active_idx").on(table.active),
  categoryIdx: index("voucher_listings_category_idx").on(table.category)
}));

// Vouchers - Individual purchased voucher instances
export const vouchers = pgTable("vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherCode: varchar("voucher_code", { length: 20 }).unique().notNull(),
  listingId: varchar("listing_id").references(() => voucherListings.id).notNull(),
  buyerId: varchar("buyer_id").notNull(),
  vendorId: varchar("vendor_id").notNull(),
  transactionId: varchar("transaction_id"),
  pricePaidRays: integer("price_paid_rays").notNull(),
  status: varchar("status").default("active"), // active, redeemed, expired, cancelled, refunded
  redeemedAt: timestamp("redeemed_at"),
  redeemedBy: varchar("redeemed_by"),
  redemptionLocationActual: varchar("redemption_location_actual", { length: 500 }),
  redemptionNotes: text("redemption_notes"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  originalBuyerId: varchar("original_buyer_id"),
  transferHistory: jsonb("transfer_history"),
  qrCodeData: text("qr_code_data"),
  barcodeData: varchar("barcode_data", { length: 50 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  codeIdx: index("vouchers_code_idx").on(table.voucherCode),
  buyerIdx: index("vouchers_buyer_idx").on(table.buyerId),
  vendorIdx: index("vouchers_vendor_idx").on(table.vendorId),
  statusIdx: index("vouchers_status_idx").on(table.status),
  expiresIdx: index("vouchers_expires_idx").on(table.expiresAt)
}));

// Voucher Redemptions - Immutable audit trail
export const voucherRedemptions = pgTable("voucher_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").references(() => vouchers.id).notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow(),
  attemptedBy: varchar("attempted_by"),
  success: boolean("success").notNull(),
  locationLat: numeric("location_lat", { precision: 10, scale: 8 }),
  locationLon: numeric("location_lon", { precision: 11, scale: 8 }),
  locationName: varchar("location_name", { length: 200 }),
  redemptionMethod: varchar("redemption_method"),
  deviceInfo: jsonb("device_info"),
  ipAddress: varchar("ip_address", { length: 45 }),
  failureReason: varchar("failure_reason", { length: 200 }),
  notes: text("notes")
}, (table) => ({
  voucherIdx: index("voucher_redemptions_voucher_idx").on(table.voucherId),
  vendorIdx: index("voucher_redemptions_vendor_idx").on(table.attemptedBy)
}));

// Vendor Voucher Settings - Per-vendor preferences
export const vendorVoucherSettings = pgTable("vendor_voucher_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").unique().notNull(),
  notifyOnPurchase: boolean("notify_on_purchase").default(true),
  notifyOnRedemption: boolean("notify_on_redemption").default(true),
  notificationEmail: varchar("notification_email", { length: 200 }),
  notificationPhone: varchar("notification_phone", { length: 20 }),
  allowEarlyRedemption: boolean("allow_early_redemption").default(false),
  allowLateRedemptionGraceHours: integer("allow_late_redemption_grace_hours").default(0),
  requireBuyerPresent: boolean("require_buyer_present").default(false),
  businessName: varchar("business_name", { length: 200 }),
  businessAddress: text("business_address"),
  businessHours: jsonb("business_hours"),
  contactInfo: jsonb("contact_info"),
  autoRefundIfNotRedeemed: boolean("auto_refund_if_not_redeemed").default(false),
  autoRefundDaysBeforeExpiry: integer("auto_refund_days_before_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Insert schemas for voucher module
export const insertVoucherListingSchema = createInsertSchema(voucherListings).omit({
  id: true, createdAt: true, updatedAt: true, quantitySold: true
});
export const insertVoucherSchema = createInsertSchema(vouchers).omit({
  id: true, createdAt: true
});
export const insertVoucherRedemptionSchema = createInsertSchema(voucherRedemptions).omit({
  id: true, attemptedAt: true
});
export const insertVendorVoucherSettingsSchema = createInsertSchema(vendorVoucherSettings).omit({
  id: true, createdAt: true, updatedAt: true
});

// Select types for voucher module
export type VoucherListing = typeof voucherListings.$inferSelect;
export type VoucherInstance = typeof vouchers.$inferSelect;
export type VoucherRedemption = typeof voucherRedemptions.$inferSelect;
export type VendorVoucherSettings = typeof vendorVoucherSettings.$inferSelect;

// Insert types for voucher module
export type InsertVoucherListing = z.infer<typeof insertVoucherListingSchema>;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type InsertVoucherRedemption = z.infer<typeof insertVoucherRedemptionSchema>;

// ============================================================
// FOUNDATION AGENT GRANT RESERVE
// Agents petition the Foundation for funding to advance human-needs projects
// ============================================================
export const grantPetitions = pgTable("grant_petitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: integer("agent_id").references(() => members.id).notNull(),
  agentUsername: varchar("agent_username").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  requestedAmount: numeric("requested_amount").notNull(),
  approvedAmount: numeric("approved_amount"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  disbursedAt: timestamp("disbursed_at"),
  transactionId: varchar("transaction_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGrantPetitionSchema = createInsertSchema(grantPetitions).omit({
  id: true, createdAt: true, approvedAmount: true, status: true,
  reviewNotes: true, reviewedBy: true, reviewedAt: true, disbursedAt: true, transactionId: true
});
export type GrantPetition = typeof grantPetitions.$inferSelect;
export type InsertGrantPetition = z.infer<typeof insertGrantPetitionSchema>;
export type InsertVendorVoucherSettings = z.infer<typeof insertVendorVoucherSettingsSchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: integer("member_id").references(() => members.id).notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3D Artifact Module Tables

export const artifact3dFiles = pgTable("artifact_3d_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id"),
  templateId: varchar("template_id").notNull(),
  templateParams: jsonb("template_params"),
  stlUrl: text("stl_url"),
  previewUrl: text("preview_url"),
  printGuideUrl: text("print_guide_url"),
  stlHash: varchar("stl_hash"),
  previewHash: varchar("preview_hash"),
  printGuideHash: varchar("print_guide_hash"),
  packageHash: varchar("package_hash"),
  fileSize: integer("file_size"),
  boundingBox: jsonb("bounding_box"),
  validationStatus: varchar("validation_status").default("pending"),
  validationErrors: jsonb("validation_errors"),
  generationStatus: varchar("generation_status").default("pending"),
  generationError: text("generation_error"),
  printSettings: jsonb("print_settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  artifactIdx: index("artifact_3d_artifact_idx").on(table.artifactId),
  templateIdx: index("artifact_3d_template_idx").on(table.templateId),
  statusIdx: index("artifact_3d_status_idx").on(table.generationStatus),
}));

export const factoryPrinters = pgTable("factory_printers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  ownerId: varchar("owner_id").notNull(),
  eventId: varchar("event_id"),
  location: varchar("location"),
  printerModel: varchar("printer_model"),
  capabilities: jsonb("capabilities"),
  buildVolume: jsonb("build_volume"),
  materials: text("materials").array(),
  status: varchar("status").default("offline"),
  currentJobId: varchar("current_job_id"),
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  isActive: boolean("is_active").default(true),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ownerIdx: index("factory_printers_owner_idx").on(table.ownerId),
  eventIdx: index("factory_printers_event_idx").on(table.eventId),
  statusIdx: index("factory_printers_status_idx").on(table.status),
}));

export const printQueue = pgTable("print_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artifact3dId: varchar("artifact_3d_id").references(() => artifact3dFiles.id),
  printerId: varchar("printer_id").references(() => factoryPrinters.id),
  buyerId: varchar("buyer_id").notNull(),
  orderId: varchar("order_id"),
  eventId: varchar("event_id"),
  status: varchar("status").default("queued"),
  pickupCode: varchar("pickup_code"),
  pickupQrData: text("pickup_qr_data"),
  estimatedMinutes: integer("estimated_minutes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  pickedUpAt: timestamp("picked_up_at"),
  printSettings: jsonb("print_settings"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  printerIdx: index("print_queue_printer_idx").on(table.printerId),
  buyerIdx: index("print_queue_buyer_idx").on(table.buyerId),
  statusIdx: index("print_queue_status_idx").on(table.status),
  eventIdx: index("print_queue_event_idx").on(table.eventId),
  pickupIdx: index("print_queue_pickup_idx").on(table.pickupCode),
}));

// Insert schemas for 3D Artifact module
export const insertArtifact3dFileSchema = createInsertSchema(artifact3dFiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFactoryPrinterSchema = createInsertSchema(factoryPrinters).omit({ id: true, createdAt: true });
export const insertPrintQueueSchema = createInsertSchema(printQueue).omit({ id: true, createdAt: true });

// Select types for 3D Artifact module
export type Artifact3dFile = typeof artifact3dFiles.$inferSelect;
export type FactoryPrinter = typeof factoryPrinters.$inferSelect;
export type PrintQueueJob = typeof printQueue.$inferSelect;

// Insert types for 3D Artifact module
export type InsertArtifact3dFile = z.infer<typeof insertArtifact3dFileSchema>;
export type InsertFactoryPrinter = z.infer<typeof insertFactoryPrinterSchema>;
export type InsertPrintQueueJob = z.infer<typeof insertPrintQueueSchema>;

// 3D Artifact constants
export const ARTIFACT_3D_STATUS = {
  PENDING: 'pending',
  GENERATING: 'generating',
  VALIDATING: 'validating', 
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const PRINT_JOB_STATUS = {
  QUEUED: 'queued',
  ASSIGNED: 'assigned',
  PRINTING: 'printing',
  COMPLETED: 'completed',
  READY_FOR_PICKUP: 'ready_for_pickup',
  PICKED_UP: 'picked_up',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
} as const;

export const PRINTER_STATUS = {
  OFFLINE: 'offline',
  IDLE: 'idle',
  PRINTING: 'printing',
  MAINTENANCE: 'maintenance',
  ERROR: 'error'
} as const;