/**
 * TC-S Network Foundation Digital Artifact Marketplace Database Schema (CommonJS)
 * Managed by TC-S, PBC Inc.
 */

const { pgTable, varchar, text, decimal, integer, timestamp, boolean, json, serial } = require('drizzle-orm/pg-core');

// Marketplace Users (linked to Foundation users)
const marketplaceUsers = pgTable('marketplace_users', {
  id: varchar('id').primaryKey(), // Links to Foundation user ID
  foundationUserId: varchar('foundation_user_id').unique(), // Reference to Foundation app
  username: varchar('username', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  solarBalance: decimal('solar_balance', { precision: 12, scale: 4 }).default('0.0000'),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 4 }).default('0.0000'),
  totalSpent: decimal('total_spent', { precision: 12, scale: 4 }).default('0.0000'),
  creatorProfile: boolean('creator_profile').default(false),
  creatorVerified: boolean('creator_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  lastActive: timestamp('last_active').defaultNow(),
  preferences: json('preferences').default({
    notifications: true,
    categories: [],
    autoSync: true
  })
});

// Digital Artifacts
const artifacts = pgTable('artifacts', {
  id: varchar('id').primaryKey(), // UUID
  creatorId: varchar('creator_id').notNull().references(() => marketplaceUsers.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: json('tags').default([]),
  price: decimal('price', { precision: 10, scale: 4 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(), // SHA-256 of file
  fileSize: integer('file_size').notNull(), // Bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  previewUrl: varchar('preview_url', { length: 500 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  downloadCount: integer('download_count').default(0),
  viewCount: integer('view_count').default(0),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),
  ratingCount: integer('rating_count').default(0),
  isActive: boolean('is_active').default(true),
  isFeatured: boolean('is_featured').default(false),
  aiCurated: boolean('ai_curated').default(false),
  aiDescription: text('ai_description'),
  aiTags: json('ai_tags').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  metadata: json('metadata')
});

// Solar Transactions Ledger
const transactions = pgTable('transactions', {
  id: varchar('id').primaryKey(), // tx_timestamp_random
  type: varchar('type', { length: 50 }).notNull(), // 'purchase', 'credit', 'transfer', 'fee'
  fromUserId: varchar('from_user_id').references(() => marketplaceUsers.id),
  toUserId: varchar('to_user_id').references(() => marketplaceUsers.id),
  artifactId: varchar('artifact_id').references(() => artifacts.id),
  amount: decimal('amount', { precision: 12, scale: 4 }).notNull(),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 4 }).default('0.0000'),
  status: varchar('status', { length: 20 }).default('completed'), // 'pending', 'completed', 'failed'
  source: varchar('source', { length: 100 }), // 'marketplace', 'foundation_sync', 'daily_distribution'
  description: text('description'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at')
});

// User Purchases (for access control)
const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull().references(() => marketplaceUsers.id),
  artifactId: varchar('artifact_id').notNull().references(() => artifacts.id),
  transactionId: varchar('transaction_id').notNull().references(() => transactions.id),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 4 }).notNull(),
  downloadCount: integer('download_count').default(0),
  lastDownload: timestamp('last_download'),
  createdAt: timestamp('created_at').defaultNow()
});

// Artifact Reviews
const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  artifactId: varchar('artifact_id').notNull().references(() => artifacts.id),
  userId: varchar('user_id').notNull().references(() => marketplaceUsers.id),
  rating: integer('rating').notNull(), // 1-5 stars
  comment: text('comment'),
  isVerifiedPurchase: boolean('is_verified_purchase').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
  marketplaceUsers,
  artifacts,
  transactions,
  purchases,
  reviews
};