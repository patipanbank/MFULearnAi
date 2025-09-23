/**
 * ConversationRoutes - HTTP API Routes
 *
 * REST API endpoints สำหรับระบบ conversation ใหม่
 * รองรับ CRUD operations และ conversation management
 */

import express from 'express';
import { ConversationOrchestrator } from '../services';
import { authenticateJWT } from '../../middleware/auth';
import { superAdminMiddleware } from '../../middleware/adminMiddleware';
import {
  CreateConversationRequest,
  SendMessageRequest,
  ConversationStatus,
  ErrorCode
} from '../types';

const router = express.Router();

// Initialize orchestrator (will be set during app initialization)
let conversationOrchestrator: ConversationOrchestrator;

export function setConversationOrchestrator(orchestrator: ConversationOrchestrator): void {
  conversationOrchestrator = orchestrator;
}

// ============= CONVERSATION ENDPOINTS =============

/**
 * GET /conversations - ดึงรายการ conversations ของ user
 */
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const conversations = await conversationOrchestrator.getUserConversations(userId);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get conversations'
      }
    });
  }
});

/**
 * POST /conversations - สร้าง conversation ใหม่
 */
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const request: CreateConversationRequest = req.body;

    // Validate request
    if (!request.title || request.title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Title is required'
        }
      });
    }

    const conversation = await conversationOrchestrator.createConversation(userId, request);

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create conversation'
      }
    });
  }
});

/**
 * GET /conversations/:conversationId - ดึง conversation ที่ระบุ
 */
router.get('/:conversationId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { conversationId } = req.params;

    // Validate conversation ID format
    if (!conversationId || conversationId.length !== 36) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Invalid conversation ID format'
        }
      });
    }

    const conversation = await conversationOrchestrator.getConversation(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Conversation not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('❌ Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get conversation'
      }
    });
  }
});

/**
 * DELETE /conversations/:conversationId - ลบ conversation
 */
router.delete('/:conversationId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { conversationId } = req.params;

    const success = await conversationOrchestrator.deleteConversation(conversationId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Conversation not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to delete conversation'
      }
    });
  }
});

// ============= MESSAGE ENDPOINTS =============

/**
 * GET /conversations/:conversationId/messages - ดึงข้อความใน conversation
 */
router.get('/:conversationId/messages', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await conversationOrchestrator.getConversationMessages(
      conversationId,
      userId,
      { limit, offset }
    );

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          limit,
          offset,
          total: messages.length
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get messages'
      }
    });
  }
});

/**
 * POST /conversations/:conversationId/messages - ส่งข้อความใหม่
 */
router.post('/:conversationId/messages', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { conversationId } = req.params;
    const request: SendMessageRequest = req.body;

    // Validate request
    if (!request.content || request.content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Message content is required'
        }
      });
    }

    if (request.content.length > 50000) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: 'Message content is too long (max 50,000 characters)'
        }
      });
    }

    const message = await conversationOrchestrator.sendMessage(conversationId, userId, request);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);

    // Handle specific error types
    if ((error as any).code === ErrorCode.PERMISSION_DENIED) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: error.message
        }
      });
    }

    if ((error as any).code === ErrorCode.INVALID_INPUT) {
      return res.status(400).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_INPUT,
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to send message'
      }
    });
  }
});

// ============= ADMIN ENDPOINTS =============

/**
 * GET /conversations/admin/stats - ดูสถิติระบบ (Admin only)
 */
router.get('/admin/stats', authenticateJWT, superAdminMiddleware, async (req: any, res) => {
  try {
    const stats = conversationOrchestrator.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting admin stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to get statistics'
      }
    });
  }
});

// ============= HEALTH CHECK =============

/**
 * GET /conversations/health - Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'conversation-service'
  });
});

export default router;