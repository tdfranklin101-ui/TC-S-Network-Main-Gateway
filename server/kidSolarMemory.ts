import { db } from "./db";
import { 
  kidSolarSessions, 
  kidSolarMemories, 
  kidSolarConversations,
  InsertKidSolarSession,
  InsertKidSolarMemory,
  InsertKidSolarConversation 
} from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";

export class KidSolarMemoryService {
  // Session Management
  async createSession(sessionId: string, userId?: string): Promise<string> {
    const [session] = await db
      .insert(kidSolarSessions)
      .values({
        sessionId,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true
      })
      .returning();
    
    return session.id;
  }

  async getOrCreateSession(sessionId: string, userId?: string): Promise<string> {
    // Try to find existing active session
    const [existingSession] = await db
      .select()
      .from(kidSolarSessions)
      .where(and(
        eq(kidSolarSessions.sessionId, sessionId),
        eq(kidSolarSessions.isActive, true)
      ))
      .limit(1);

    if (existingSession) {
      // Update last activity
      await db
        .update(kidSolarSessions)
        .set({ lastActivity: new Date() })
        .where(eq(kidSolarSessions.id, existingSession.id));
      
      return existingSession.id;
    }

    // Create new session
    return this.createSession(sessionId, userId);
  }

  // Memory Storage
  async storeImageMemory(
    sessionId: string,
    imageData: {
      fileName: string;
      fileType: string;
      imageBase64?: string;
      imageUrl?: string;
      analysisText?: string;
      energyKwh?: string;
      solarTokens?: string;
      userMessage?: string;
      metadata?: any;
    }
  ): Promise<string> {
    const [memory] = await db
      .insert(kidSolarMemories)
      .values({
        sessionId,
        memoryType: 'image',
        fileName: imageData.fileName,
        fileType: imageData.fileType,
        imageBase64: imageData.imageBase64,
        imageUrl: imageData.imageUrl,
        analysisText: imageData.analysisText,
        energyKwh: imageData.energyKwh,
        solarTokens: imageData.solarTokens,
        userMessage: imageData.userMessage,
        metadata: imageData.metadata,
        timestamp: new Date()
      })
      .returning();

    return memory.id;
  }

  async storeConversation(
    sessionId: string,
    messageType: 'user' | 'kid_solar' | 'system',
    messageText: string,
    memoryId?: string
  ): Promise<string> {
    const [conversation] = await db
      .insert(kidSolarConversations)
      .values({
        sessionId,
        memoryId,
        messageType,
        messageText,
        timestamp: new Date()
      })
      .returning();

    return conversation.id;
  }

  // Memory Retrieval
  async getSessionMemories(sessionId: string, limit: number = 10) {
    return await db
      .select()
      .from(kidSolarMemories)
      .where(eq(kidSolarMemories.sessionId, sessionId))
      .orderBy(desc(kidSolarMemories.timestamp))
      .limit(limit);
  }

  async getSessionConversations(sessionId: string, limit: number = 50) {
    return await db
      .select()
      .from(kidSolarConversations)
      .where(eq(kidSolarConversations.sessionId, sessionId))
      .orderBy(desc(kidSolarConversations.timestamp))
      .limit(limit);
  }

  async getRecentAnalyses(sessionId: string, limit: number = 5) {
    return await db
      .select()
      .from(kidSolarMemories)
      .where(and(
        eq(kidSolarMemories.sessionId, sessionId),
        eq(kidSolarMemories.memoryType, 'image')
      ))
      .orderBy(desc(kidSolarMemories.timestamp))
      .limit(limit);
  }

  // Context Building
  async buildContextForKidSolar(sessionId: string): Promise<string> {
    const memories = await this.getSessionMemories(sessionId, 5);
    const conversations = await this.getSessionConversations(sessionId, 10);

    let context = "Kid Solar's Memory Context:\n\n";

    if (memories.length > 0) {
      context += "Recent Images Analyzed:\n";
      memories.forEach((memory, index) => {
        if (memory.analysisText) {
          context += `${index + 1}. ${memory.fileName}: ${memory.analysisText}\n`;
          if (memory.energyKwh) {
            context += `   Energy: ${memory.energyKwh} kWh, ${memory.solarTokens} SOLAR tokens\n`;
          }
        }
      });
      context += "\n";
    }

    if (conversations.length > 0) {
      context += "Recent Conversation:\n";
      conversations.reverse().forEach((conv) => {
        const speaker = conv.messageType === 'kid_solar' ? 'Kid Solar' : 
                       conv.messageType === 'user' ? 'User' : 'System';
        context += `${speaker}: ${conv.messageText}\n`;
      });
    }

    return context;
  }

  // Session Management
  async endSession(sessionId: string): Promise<void> {
    await db
      .update(kidSolarSessions)
      .set({ 
        isActive: false,
        lastActivity: new Date()
      })
      .where(eq(kidSolarSessions.sessionId, sessionId));
  }
}

export const kidSolarMemory = new KidSolarMemoryService();