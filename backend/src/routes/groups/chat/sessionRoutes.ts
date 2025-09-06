import express from 'express';
import { chatService } from '../../../services/chatService';
import { authenticateJWT } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { z } from 'zod';

/**
 * Session Routes - จัดการ chat sessions และ WebSocket connections
 */
const router = express.Router();

// Validation schemas
const createSessionSchema = z.object({
  body: z.object({
    agentId: z.string(),
    name: z.string().min(1).max(100).optional(),
    config: z.object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).max(100000).optional(),
      systemPrompt: z.string().optional()
    }).optional()
  })
});

// Get active sessions for user
router.get('/active', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    
    const sessions = await chatService.getActiveSessions(userId);
    
    res.json({
      success: true,
      data: sessions,
      meta: {
        total: sessions.length,
        userId
      }
    });
  } catch (error) {
    console.error('❌ Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active sessions',
      code: 'SESSIONS_FETCH_ERROR'
    });
  }
});

// Create new session
router.post('/', authenticateJWT, validateRequest(createSessionSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId, name, config } = req.body;
    
    const session = await chatService.createSession({
      userId,
      agentId,
      name: name || `Session ${Date.now()}`,
      config
    });
    
    res.status(201).json({
      success: true,
      data: session,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      code: 'SESSION_CREATE_ERROR'
    });
  }
});

// Get session details
router.get('/:sessionId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sessionId } = req.params;
    
    const session = await chatService.getSession(sessionId, userId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('❌ Error getting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session',
      code: 'SESSION_FETCH_ERROR'
    });
  }
});

// Update session
router.put('/:sessionId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sessionId } = req.params;
    const updates = req.body;
    
    const session = await chatService.updateSession(sessionId, userId, updates);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: session,
      message: 'Session updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
      code: 'SESSION_UPDATE_ERROR'
    });
  }
});

// End session
router.post('/:sessionId/end', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sessionId } = req.params;
    
    const success = await chatService.endSession(sessionId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session',
      code: 'SESSION_END_ERROR'
    });
  }
});

// Get session statistics
router.get('/:sessionId/stats', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sessionId } = req.params;
    
    const stats = await chatService.getSessionStats(sessionId, userId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting session stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session statistics',
      code: 'SESSION_STATS_ERROR'
    });
  }
});

// Transfer session to different agent
router.post('/:sessionId/transfer', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sessionId } = req.params;
    const { targetAgentId, reason } = req.body;
    
    if (!targetAgentId) {
      return res.status(400).json({
        success: false,
        error: 'Target agent ID is required',
        code: 'MISSING_AGENT_ID'
      });
    }
    
    const session = await chatService.transferSession(sessionId, userId, targetAgentId, reason);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: session,
      message: 'Session transferred successfully'
    });
  } catch (error) {
    console.error('❌ Error transferring session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer session',
      code: 'SESSION_TRANSFER_ERROR'
    });
  }
});

export { router as sessionRoutes };