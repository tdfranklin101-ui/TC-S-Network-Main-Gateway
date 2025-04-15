import { pgTable, serial, text, timestamp, integer, boolean, pgEnum, real } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  password: text('password').notNull(),
  joinDate: timestamp('join_date').defaultNow().notNull(),
  solarBalance: real('solar_balance').default(0).notNull(),
  lastDistribution: timestamp('last_distribution'),
  isAdmin: boolean('is_admin').default(false).notNull(),
});

// Scan history table
export const productScans = pgTable('product_scans', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  energyKwh: real('energy_kwh').notNull(),
  scanMethod: text('scan_method').default('manual').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  city: text('city'),
  country: text('country'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  notes: text('notes'),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  productScans: many(productScans),
}));

export const productScansRelations = relations(productScans, ({ one }) => ({
  user: one(users, {
    fields: [productScans.userId],
    references: [users.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true });

export const insertProductScanSchema = createInsertSchema(productScans)
  .omit({ id: true, timestamp: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ProductScan = typeof productScans.$inferSelect;
export type InsertProductScan = z.infer<typeof insertProductScanSchema>;