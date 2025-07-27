import { db } from "./db";
import { 
  kidSolarSessions, 
  kidSolarMemories, 
  kidSolarConversations
} from "../shared/schema";
import { eq, desc, and, lt } from "drizzle-orm";

export interface SessionMessage {
  id: string;
  messageType: 'user' | 'kid_solar' | 'system';
  messageText: string;
  timestamp: Date;
  metadata?: any;
}

export interface SessionImage {
  id: string;
  fileName: string;
  fileType: string;
  imageBase64?: string;
  imageUrl?: string;
  analysisText?: string;
  energyKwh?: string;
  solarTokens?: string;
  timestamp: Date;
}

export interface SessionBuffer {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  messages: SessionMessage[];
  images: SessionImage[];
  metadata: any;
  isActive: boolean;
}

export class SessionLifecycleManager {
  private activeSessions = new Map<string, SessionBuffer>();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start periodic cleanup of inactive sessions
    setInterval(() => this.cleanupInactiveSessions(), this.CLEANUP_INTERVAL);
  }

  // Session Creation and Management
  async startSession(sessionId: string, userId?: string): Promise<SessionBuffer> {
    const now = new Date();
    
    // Check if session already exists in permanent storage
    const existingSession = await db
      .select()
      .from(kidSolarSessions)
      .where(eq(kidSolarSessions.sessionId, sessionId))
      .limit(1);

    const sessionBuffer: SessionBuffer = {
      sessionId,
      startTime: now,
      lastActivity: now,
      messages: [],
      images: [],
      metadata: { userId },
      isActive: true
    };

    this.activeSessions.set(sessionId, sessionBuffer);
    
    console.log(`🚀 Session started: ${sessionId} - Temporary storage active`);
    return sessionBuffer;
  }

  // Add message to temporary session buffer
  addMessage(sessionId: string, messageType: 'user' | 'kid_solar' | 'system', messageText: string, metadata?: any): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`Session ${sessionId} not found or inactive`);
      return false;
    }

    const message: SessionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messageType,
      messageText,
      timestamp: new Date(),
      metadata
    };

    session.messages.push(message);
    session.lastActivity = new Date();
    
    // Check for session end indicators
    this.checkForSessionEndTriggers(sessionId, messageText, messageType);
    
    console.log(`💬 Message added to session buffer: ${sessionId} (${session.messages.length} messages)`);
    return true;
  }

  // Add image to temporary session buffer
  addImage(sessionId: string, imageData: Partial<SessionImage>): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`Session ${sessionId} not found or inactive`);
      return false;
    }

    const image: SessionImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: imageData.fileName || 'unknown',
      fileType: imageData.fileType || 'unknown',
      imageBase64: imageData.imageBase64,
      imageUrl: imageData.imageUrl,
      analysisText: imageData.analysisText,
      energyKwh: imageData.energyKwh,
      solarTokens: imageData.solarTokens,
      timestamp: new Date()
    };

    session.images.push(image);
    session.lastActivity = new Date();
    
    console.log(`🖼️ Image added to session buffer: ${sessionId} (${session.images.length} images)`);
    return true;
  }

  // Check for natural session end triggers
  private checkForSessionEndTriggers(sessionId: string, messageText: string, messageType: string): void {
    if (messageType !== 'user') return;
    
    const endTriggers = [
      /goodbye|bye|thanks|thank you|see you|done|finished|that's all/i,
      /no more questions|all set|perfect|great|awesome/i,
      /end session|stop|quit|exit|close/i
    ];

    const isEndTrigger = endTriggers.some(pattern => pattern.test(messageText));
    
    if (isEndTrigger) {
      console.log(`🔚 Session end trigger detected in: "${messageText}"`);
      this.markSessionForCompletion(sessionId);
    }
  }

  // Mark session as ready for completion
  private markSessionForCompletion(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.metadata.readyForCompletion = true;
      session.metadata.completionTrigger = 'user_indicated';
      console.log(`📋 Session ${sessionId} marked ready for user commitment decision`);
    }
  }

  // Get session buffer for display/decision
  getSessionBuffer(sessionId: string): SessionBuffer | null {
    return this.activeSessions.get(sessionId) || null;
  }

  // Get session summary for user decision
  getSessionSummary(sessionId: string): any {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const messageCount = session.messages.length;
    const imageCount = session.images.length;
    const duration = new Date().getTime() - session.startTime.getTime();
    const durationMinutes = Math.round(duration / 60000);

    // Extract topics from conversation
    const topics = this.extractTopics(session);
    
    return {
      sessionId,
      startTime: session.startTime,
      duration: durationMinutes,
      messageCount,
      imageCount,
      topics,
      preview: this.generatePreview(session),
      readyForCompletion: session.metadata.readyForCompletion || false
    };
  }

  // Extract conversation topics for summary
  private extractTopics(session: SessionBuffer): string[] {
    const allText = session.messages
      .map(m => m.messageText)
      .join(' ')
      .toLowerCase();

    const topicKeywords: Record<string, RegExp> = {
      'solar energy': /solar|photovoltaic|pv|panel|renewable/g,
      'sustainability': /sustainable|environment|green|eco/g,
      'energy storage': /battery|storage|grid|backup/g,
      'technology': /technology|innovation|engineering|system/g,
      'education': /learn|teach|explain|understand|question/g
    };

    return Object.keys(topicKeywords).filter(topic => 
      topicKeywords[topic].test(allText)
    );
  }

  // Generate conversation preview
  private generatePreview(session: SessionBuffer): string {
    if (session.messages.length === 0) return "No conversation yet";
    
    const firstUserMessage = session.messages.find(m => m.messageType === 'user');
    const lastMessages = session.messages.slice(-2);
    
    let preview = '';
    if (firstUserMessage) {
      preview = `Started with: "${firstUserMessage.messageText.substring(0, 100)}..."\n`;
    }
    if (lastMessages.length > 0) {
      preview += `Recent: "${lastMessages[lastMessages.length - 1].messageText.substring(0, 100)}..."`;
    }
    
    return preview;
  }

  // Commit session to permanent storage
  async commitSessionToPermanentStorage(sessionId: string, userDecision: {
    saveConversation: boolean;
    saveImages: boolean;
    saveHighlightsOnly?: boolean;
    userNotes?: string;
  }): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found for commitment`);
      return false;
    }

    try {
      // Create permanent session record
      const [permanentSession] = await db
        .insert(kidSolarSessions)
        .values({
          sessionId,
          userId: session.metadata.userId,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          isActive: false,
          metadata: {
            ...session.metadata,
            userDecision,
            messageCount: session.messages.length,
            imageCount: session.images.length,
            commitmentDate: new Date()
          }
        })
        .returning();

      // Save conversations if requested
      if (userDecision.saveConversation && session.messages.length > 0) {
        const conversationsToSave = userDecision.saveHighlightsOnly 
          ? this.extractHighlights(session.messages)
          : session.messages;

        for (const message of conversationsToSave) {
          await db.insert(kidSolarConversations).values({
            sessionId: permanentSession.id,
            messageType: message.messageType,
            messageText: message.messageText,
            timestamp: message.timestamp
          });
        }
      }

      // Save images if requested
      if (userDecision.saveImages && session.images.length > 0) {
        for (const image of session.images) {
          await db.insert(kidSolarMemories).values({
            sessionId: permanentSession.id,
            memoryType: 'image',
            fileName: image.fileName,
            fileType: image.fileType,
            imageBase64: image.imageBase64,
            imageUrl: image.imageUrl,
            analysisText: image.analysisText,
            energyKwh: image.energyKwh,
            solarTokens: image.solarTokens,
            timestamp: image.timestamp,
            metadata: { userNotes: userDecision.userNotes }
          });
        }
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      console.log(`✅ Session ${sessionId} committed to permanent storage`);
      console.log(`📊 Saved: ${userDecision.saveConversation ? session.messages.length : 0} messages, ${userDecision.saveImages ? session.images.length : 0} images`);
      
      return true;
    } catch (error) {
      console.error(`Failed to commit session ${sessionId}:`, error);
      return false;
    }
  }

  // Extract conversation highlights for summary storage
  private extractHighlights(messages: SessionMessage[]): SessionMessage[] {
    // Simple implementation - can be enhanced with AI summarization
    const highlights: SessionMessage[] = [];
    
    // Always include first and last messages
    if (messages.length > 0) {
      highlights.push(messages[0]);
      if (messages.length > 1) {
        highlights.push(messages[messages.length - 1]);
      }
    }
    
    // Include messages with key educational content
    const keyMessages = messages.filter(msg => 
      msg.messageText.length > 100 && 
      (msg.messageText.includes('solar') || 
       msg.messageText.includes('energy') ||
       msg.messageText.includes('renewable'))
    );
    
    highlights.push(...keyMessages.slice(0, 3)); // Limit to 3 key messages
    
    return highlights;
  }

  // Discard session without saving
  async discardSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    this.activeSessions.delete(sessionId);
    console.log(`🗑️ Session ${sessionId} discarded without saving`);
    return true;
  }

  // Auto-cleanup inactive sessions
  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date().getTime();
    const sessionsToTimeout: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceActivity = now - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        sessionsToTimeout.push(sessionId);
      }
    }

    for (const sessionId of sessionsToTimeout) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.messages.length > 0) {
        // Mark for user decision rather than auto-discard
        session.metadata.timedOut = true;
        session.metadata.timeoutReason = 'inactivity';
        console.log(`⏰ Session ${sessionId} timed out - awaiting user decision`);
      } else {
        // Discard empty sessions
        this.activeSessions.delete(sessionId);
        console.log(`🗑️ Empty session ${sessionId} auto-discarded after timeout`);
      }
    }
  }

  // Get sessions pending user decision
  getSessionsPendingDecision(): any[] {
    const pending: any[] = [];
    
    for (const sessionId of Array.from(this.activeSessions.keys())) {
      const session = this.activeSessions.get(sessionId);
      if (session && (session.metadata.readyForCompletion || session.metadata.timedOut)) {
        pending.push(this.getSessionSummary(sessionId));
      }
    }
    
    return pending;
  }

  // Get active session count
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  // Update session activity
  updateActivity(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }
}

export const sessionLifecycle = new SessionLifecycleManager();