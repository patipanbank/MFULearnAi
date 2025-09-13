import express from 'express';
import { chatService } from '../../../services/chatService';
import { authenticateJWT } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { z } from 'zod';

/**
 * Chat Main Routes - หลัก routes สำหรับ chat operations
 */
const router = express.Router();

// Validation schemas
const createChatSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    agentId: z.string(),
    initialMessage: z.string().optional()
  })
});

const updateChatSchema = z.object({
  params: z.object({
    chatId: z.string()
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    isPinned: z.boolean().optional()
  })
});

// Get all chats for user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { limit, offset, search, agentId } = req.query;
    
    const chats = await chatService.getUserChats(userId);
    
    return res.json({
      success: true,
      data: chats,
      meta: {
        total: chats.length,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting user chats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat history',
      code: 'CHAT_FETCH_ERROR'
    });
  }
});

// Get chat history (alias for compatibility)
router.get('/history', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const chats = await chatService.getUserChats(userId);
    
    // Return array directly for frontend compatibility
    return res.json(chats);
  } catch (error) {
    console.error('❌ Error getting chat history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

// Get specific chat
router.get('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    
    const chat = await chatService.getChatWithMessages(chatId, userId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
        code: 'CHAT_NOT_FOUND'
      });
    }
    
    return res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('❌ Error getting chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat',
      code: 'CHAT_FETCH_ERROR'
    });
  }
});

// Create new chat
router.post('/', authenticateJWT, validateRequest(createChatSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { name, agentId, initialMessage } = req.body;
    
    const chat = await chatService.createChat(name, agentId, userId);
    
    return res.status(201).json({
      success: true,
      data: chat,
      message: 'Chat created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create chat',
      code: 'CHAT_CREATE_ERROR'
    });
  }
});

// Update chat
router.put('/:chatId', authenticateJWT, validateRequest(updateChatSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    const updates = req.body;
    
    const chat = await chatService.updateChat(chatId, updates);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
        code: 'CHAT_NOT_FOUND'
      });
    }
    
    return res.json({
      success: true,
      data: chat,
      message: 'Chat updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update chat',
      code: 'CHAT_UPDATE_ERROR'
    });
  }
});

// Delete chat
router.delete('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    
    const success = await chatService.deleteChat(chatId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
        code: 'CHAT_NOT_FOUND'
      });
    }
    
    return res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete chat',
      code: 'CHAT_DELETE_ERROR'
    });
  }
});

// Batch operations
router.post('/batch', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { operation, chatIds } = req.body;
    
    let result;
    switch (operation) {
      case 'delete':
        result = await chatService.batchDeleteChats(chatIds);
        break;
      case 'pin':
        result = await chatService.batchPinChats(chatIds, true);
        break;
      case 'unpin':
        result = await chatService.batchPinChats(chatIds, false);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid batch operation',
          code: 'INVALID_OPERATION'
        });
    }
    
    return res.json({
      success: true,
      data: result,
      message: `Batch ${operation} completed successfully`
    });
  } catch (error) {
    console.error('❌ Error in batch operation:', error);
    return res.status(500).json({
      success: false,
      error: 'Batch operation failed',
      code: 'BATCH_OPERATION_ERROR'
    });
  }
});

export { router as chatRoutes };