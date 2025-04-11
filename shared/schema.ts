import { pgTable, text, serial, integer, boolean, timestamp, date, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enum for distribution status
export const distributionStatusEnum = pgEnum('distribution_status', ['pending', 'processed', 'failed']);

// User model - expanded to include more fields for registration
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  solarAccounts: many(solarAccounts),
  distributions: many(distributions),
}));

// Solar account model (for tracking personal accumulation)
export const solarAccounts = pgTable("solar_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountNumber: text("account_number").notNull().unique(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  displayName: text("display_name"),
  totalSolar: numeric("total_solar").default("0").notNull(),
  totalKwh: numeric("total_kwh").default("0").notNull(),
  totalDollars: numeric("total_dollars").default("0").notNull(),
  joinedDate: timestamp("joined_date").defaultNow(),
});

export const insertSolarAccountSchema = createInsertSchema(solarAccounts).pick({
  userId: true,
  isAnonymous: true,
  displayName: true,
});

// Solar account relations
export const solarAccountsRelations = relations(solarAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [solarAccounts.userId],
    references: [users.id],
  }),
  distributions: many(distributions),
}));

// Daily distribution tracking
export const distributions = pgTable("distributions", {
  id: serial("id").primaryKey(),
  solarAccountId: integer("solar_account_id").notNull().references(() => solarAccounts.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  distributionDate: date("distribution_date").notNull(),
  solarAmount: numeric("solar_amount").notNull(),
  kwhAmount: numeric("kwh_amount").notNull(),
  dollarValue: numeric("dollar_value").notNull(),
  status: distributionStatusEnum("status").default("pending").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDistributionSchema = createInsertSchema(distributions).pick({
  solarAccountId: true,
  userId: true,
  distributionDate: true,
  solarAmount: true,
  kwhAmount: true,
  dollarValue: true,
  status: true,
});

// Distribution relations
export const distributionsRelations = relations(distributions, ({ one }) => ({
  user: one(users, {
    fields: [distributions.userId],
    references: [users.id],
  }),
  solarAccount: one(solarAccounts, {
    fields: [distributions.solarAccountId],
    references: [solarAccounts.id],
  }),
}));

// Product model
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // Price in cents
  imageUrl: text("image_url").notNull(),
  isNew: boolean("is_new").default(false),
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  isNew: true,
});

// Newsletter subscription model
export const newsletterSubscriptions = pgTable("newsletter_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
});

export const insertNewsletterSubscriptionSchema = createInsertSchema(newsletterSubscriptions).pick({
  email: true,
});

// Contact message model
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).pick({
  name: true,
  email: true,
  message: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSolarAccount = z.infer<typeof insertSolarAccountSchema>;
export type SolarAccount = typeof solarAccounts.$inferSelect;

export type InsertDistribution = z.infer<typeof insertDistributionSchema>;
export type Distribution = typeof distributions.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertNewsletterSubscription = z.infer<typeof insertNewsletterSubscriptionSchema>;
export type NewsletterSubscription = typeof newsletterSubscriptions.$inferSelect;

export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
