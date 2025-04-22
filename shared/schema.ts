import { pgTable, serial, text, boolean, timestamp, integer, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Members table schema
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  joinedDate: text('joined_date').notNull(),
  totalSolar: decimal('total_solar', { precision: 20, scale: 4 }).notNull().default('1'),
  totalDollars: decimal('total_dollars', { precision: 20, scale: 2 }).notNull(),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  isReserve: boolean('is_reserve').notNull().default(false),
  isPlaceholder: boolean('is_placeholder').notNull().default(false),
  lastDistributionDate: text('last_distribution_date').notNull(),
  notes: text('notes'),
  signupTimestamp: timestamp('signup_timestamp').defaultNow()
});

// Define types based on the schema
export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

// Create a validator schema for member insertion
export const insertMemberSchema = createInsertSchema(members);

// Distribution logs table to track all SOLAR distributions
export const distributionLogs = pgTable('distribution_logs', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  distributionDate: text('distribution_date').notNull(),
  solarAmount: decimal('solar_amount', { precision: 20, scale: 4 }).notNull(),
  dollarValue: decimal('dollar_value', { precision: 20, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow()
});

export type DistributionLog = typeof distributionLogs.$inferSelect;
export type InsertDistributionLog = typeof distributionLogs.$inferInsert;
export const insertDistributionLogSchema = createInsertSchema(distributionLogs);

// Backup logs table to track database backups
export const backupLogs = pgTable('backup_logs', {
  id: serial('id').primaryKey(),
  backupType: text('backup_type').notNull(), // daily, timestamped, etc.
  filename: text('filename').notNull(),
  memberCount: integer('member_count').notNull(),
  timestamp: timestamp('timestamp').defaultNow()
});

export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = typeof backupLogs.$inferInsert;
export const insertBackupLogSchema = createInsertSchema(backupLogs);