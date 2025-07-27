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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;