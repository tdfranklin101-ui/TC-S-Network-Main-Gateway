import type { Express, Request, Response } from "express";
import { sessionLifecycle } from "./sessionLifecycle";
import { z } from "zod";

// Request validation schemas
const sessionMessageSchema = z.object({
  sessionId: z.string(),
  messageType: z.enum(['user', 'kid_solar', 'system']),
  messageText: z.string(),
  metadata: z.any().optional()
});

const sessionImageSchema = z.object({
  sessionId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  imageBase64: z.string().optional(),
  imageUrl: z.string().optional(),
  analysisText: z.string().optional(),
  energyKwh: z.string().optional(),
  solarTokens: z.string().optional()
});

const sessionCommitSchema = z.object({
  sessionId: z.string(),
  saveConversation: z.boolean(),
  saveImages: z.boolean(),
  saveHighlightsOnly: z.boolean().optional().default(false),
  userNotes: z.string().optional()
});

export function registerSessionAPI(app: Express): void {
  
  // Start new session
  app.post('/api/session/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, userId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      const session = await sessionLifecycle.startSession(sessionId, userId);
      
      res.json({
        success: true,
        sessionId: session.sessionId,
        startTime: session.startTime,
        message: 'Session started - temporary storage active'
      });
    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({ error: 'Failed to start session' });
    }
  });

  // Add message to session buffer
  app.post('/api/session/message', async (req: Request, res: Response) => {
    try {
      const validatedData = sessionMessageSchema.parse(req.body);
      
      const success = sessionLifecycle.addMessage(
        validatedData.sessionId,
        validatedData.messageType,
        validatedData.messageText,
        validatedData.metadata
      );

      if (!success) {
        return res.status(404).json({ error: 'Session not found or inactive' });
      }

      // Check if session is ready for completion
      const sessionSummary = sessionLifecycle.getSessionSummary(validatedData.sessionId);
      
      res.json({
        success: true,
        messageAdded: true,
        sessionReady: sessionSummary?.readyForCompletion || false,
        messageCount: sessionSummary?.messageCount || 0
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error adding message:', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  });

  // Add image to session buffer
  app.post('/api/session/image', async (req: Request, res: Response) => {
    try {
      const validatedData = sessionImageSchema.parse(req.body);
      
      const success = sessionLifecycle.addImage(validatedData.sessionId, {
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        imageBase64: validatedData.imageBase64,
        imageUrl: validatedData.imageUrl,
        analysisText: validatedData.analysisText,
        energyKwh: validatedData.energyKwh,
        solarTokens: validatedData.solarTokens
      });

      if (!success) {
        return res.status(404).json({ error: 'Session not found or inactive' });
      }

      const sessionSummary = sessionLifecycle.getSessionSummary(validatedData.sessionId);
      
      res.json({
        success: true,
        imageAdded: true,
        imageCount: sessionSummary?.imageCount || 0
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error adding image:', error);
      res.status(500).json({ error: 'Failed to add image' });
    }
  });

  // Get session summary for user decision
  app.get('/api/session/:sessionId/summary', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const summary = sessionLifecycle.getSessionSummary(sessionId);
      
      if (!summary) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Error getting session summary:', error);
      res.status(500).json({ error: 'Failed to get session summary' });
    }
  });

  // Get session buffer content for preview
  app.get('/api/session/:sessionId/preview', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const sessionBuffer = sessionLifecycle.getSessionBuffer(sessionId);
      
      if (!sessionBuffer) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Return sanitized preview (no sensitive data)
      res.json({
        success: true,
        preview: {
          sessionId: sessionBuffer.sessionId,
          startTime: sessionBuffer.startTime,
          messageCount: sessionBuffer.messages.length,
          imageCount: sessionBuffer.images.length,
          lastActivity: sessionBuffer.lastActivity,
          isActive: sessionBuffer.isActive,
          messages: sessionBuffer.messages.map(m => ({
            messageType: m.messageType,
            messageText: m.messageText.substring(0, 200) + (m.messageText.length > 200 ? '...' : ''),
            timestamp: m.timestamp
          })),
          images: sessionBuffer.images.map(img => ({
            fileName: img.fileName,
            fileType: img.fileType,
            analysisText: img.analysisText?.substring(0, 200) + (img.analysisText && img.analysisText.length > 200 ? '...' : ''),
            timestamp: img.timestamp
          }))
        }
      });
    } catch (error) {
      console.error('Error getting session preview:', error);
      res.status(500).json({ error: 'Failed to get session preview' });
    }
  });

  // Commit session to permanent storage
  app.post('/api/session/commit', async (req: Request, res: Response) => {
    try {
      const validatedData = sessionCommitSchema.parse(req.body);
      
      const success = await sessionLifecycle.commitSessionToPermanentStorage(
        validatedData.sessionId,
        {
          saveConversation: validatedData.saveConversation,
          saveImages: validatedData.saveImages,
          saveHighlightsOnly: validatedData.saveHighlightsOnly,
          userNotes: validatedData.userNotes
        }
      );

      if (!success) {
        return res.status(404).json({ error: 'Session not found or commitment failed' });
      }

      res.json({
        success: true,
        message: 'Session committed to permanent storage',
        saved: {
          conversation: validatedData.saveConversation,
          images: validatedData.saveImages,
          highlightsOnly: validatedData.saveHighlightsOnly
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error committing session:', error);
      res.status(500).json({ error: 'Failed to commit session' });
    }
  });

  // Discard session without saving
  app.post('/api/session/discard', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      const success = await sessionLifecycle.discardSession(sessionId);
      
      if (!success) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        message: 'Session discarded without saving'
      });
    } catch (error) {
      console.error('Error discarding session:', error);
      res.status(500).json({ error: 'Failed to discard session' });
    }
  });

  // Get sessions pending user decision
  app.get('/api/session/pending', async (req: Request, res: Response) => {
    try {
      const pendingSessions = sessionLifecycle.getSessionsPendingDecision();
      
      res.json({
        success: true,
        pendingSessions,
        count: pendingSessions.length
      });
    } catch (error) {
      console.error('Error getting pending sessions:', error);
      res.status(500).json({ error: 'Failed to get pending sessions' });
    }
  });

  // Update session activity (heartbeat)
  app.post('/api/session/heartbeat', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      const success = sessionLifecycle.updateActivity(sessionId);
      
      res.json({
        success,
        message: success ? 'Activity updated' : 'Session not found'
      });
    } catch (error) {
      console.error('Error updating session activity:', error);
      res.status(500).json({ error: 'Failed to update activity' });
    }
  });

  // Get system statistics
  app.get('/api/session/stats', async (req: Request, res: Response) => {
    try {
      const activeSessionCount = sessionLifecycle.getActiveSessionCount();
      const pendingSessions = sessionLifecycle.getSessionsPendingDecision();
      
      res.json({
        success: true,
        stats: {
          activeSessions: activeSessionCount,
          pendingDecisions: pendingSessions.length,
          totalPending: pendingSessions.length
        }
      });
    } catch (error) {
      console.error('Error getting session stats:', error);
      res.status(500).json({ error: 'Failed to get session stats' });
    }
  });
}