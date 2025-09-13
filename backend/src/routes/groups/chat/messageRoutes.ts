import express from 'express';
import { chatService } from '../../../services/chatService';
import { authenticateJWT } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { z } from 'zod';

/**
 * Message Routes - จัดการ messages ใน chat
 */
const router = express.Router();

// Validation schemas
const sendMessageSchema = z.object({
  body: z.object({
    chatId: z.string(),
    content: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system']).optional().default('user'),
    images: z.array(z.object({
      url: z.string(),
      mediaType: z.string()
    })).optional()
  })
});

const updateMessageSchema = z.object({
  params: z.object({
    messageId: z.string()
  }),
  body: z.object({
    content: z.string().min(1).optional(),
    isComplete: z.boolean().optional(),
    toolUsage: z.array(z.object({
      type: z.enum(['tool_start', 'tool_result', 'tool_error']),
      tool_name: z.string(),
      tool_input: z.string().optional(),
      output: z.string().optional(),
      error: z.string().optional()
    })).optional()
  })
});

// Get messages for a chat
router.get('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    const { limit, offset, before, after } = req.query;
    
    const messages = await chatService.getChatMessages(chatId, userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      before,
      after
    });
    
    res.json({
      success: true,
      data: messages,
      meta: {
        chatId,
        total: messages.length,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      code: 'MESSAGES_FETCH_ERROR'
    });
  }
});

// Send new message
router.post('/', authenticateJWT, validateRequest(sendMessageSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId, content, role, images } = req.body;
    
    const message = await chatService.addMessage(chatId, userId, {
      content,
      role,
      images
    });
    
    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      code: 'MESSAGE_SEND_ERROR'
    });
  }
});

// Update message
router.put('/:messageId', authenticateJWT, validateRequest(updateMessageSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { messageId } = req.params;
    const updates = req.body;
    
    const message = await chatService.updateMessage(messageId, userId, updates);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        code: 'MESSAGE_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: message,
      message: 'Message updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update message',
      code: 'MESSAGE_UPDATE_ERROR'
    });
  }
});

// Delete message
router.delete('/:messageId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { messageId } = req.params;
    
    const success = await chatService.deleteMessage(messageId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        code: 'MESSAGE_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message',
      code: 'MESSAGE_DELETE_ERROR'
    });
  }
});

// Search messages
router.get('/:chatId/search', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    const { query, role, dateFrom, dateTo } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      });
    }
    
    const messages = await chatService.searchMessages(chatId, userId, {
      query,
      role,
      dateFrom,
      dateTo
    });
    
    res.json({
      success: true,
      data: messages,
      meta: {
        chatId,
        query,
        total: messages.length
      }
    });
  } catch (error) {
    console.error('❌ Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      code: 'MESSAGE_SEARCH_ERROR'
    });
  }
});

// Export messages
router.get('/:chatId/export', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { chatId } = req.params;
    const { format = 'json' } = req.query;
    
    const messages = await chatService.getChatMessages(chatId, userId);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}-messages.json"`);
      res.json(messages);
    } else if (format === 'txt') {
      const txtContent = messages.map(msg => 
        `[${msg.timestamp}] ${msg.role}: ${msg.content}`
      ).join('\n\n');
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}-messages.txt"`);
      res.send(txtContent);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format',
        code: 'UNSUPPORTED_FORMAT'
      });
    }
  } catch (error) {
    console.error('❌ Error exporting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export messages',
      code: 'MESSAGE_EXPORT_ERROR'
    });
  }
});

export { router as messageRoutes };