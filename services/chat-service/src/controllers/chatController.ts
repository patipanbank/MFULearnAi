import { Router, Response } from 'express';
import { ChatService } from '../services/chatService';
import { AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Chat Controller
 * REST API endpoints for chat management
 */

export const chatRouter = Router();
const chatService = new ChatService();

/**
 * GET /api/chat
 * List user's chats
 */
chatRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    const chats = await chatService.getUserChats(userId);

    res.json(chats);

  } catch (error: any) {
    logger.error('❌ Error getting user chats', {
      userId: req.user?.sub,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to get chat history',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history
 * List user's chats (legacy endpoint for frontend compatibility)
 */
chatRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;

    const chats = await chatService.getUserChats(userId);

    res.json(chats);

  } catch (error: any) {
    logger.error('❌ Error getting chat history', {
      userId: req.user?.sub,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to get chat history',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Get specific chat by session ID (legacy endpoint)
 */
chatRouter.get('/history/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { sessionId } = req.params;

    // Validate sessionId format
    if (!sessionId || sessionId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format',
      });
    }

    const chat = await chatService.getChat(sessionId, userId);

    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    res.json(chat);

  } catch (error: any) {
    logger.error('❌ Error getting chat history', {
      userId: req.user?.sub,
      sessionId: req.params.sessionId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to get chat history',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat
 * Create a new chat
 */
chatRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { name, agentId } = req.body;

    const chat = await chatService.createChat(userId, name || 'New Chat', agentId);

    res.status(201).json(chat);

  } catch (error: any) {
    logger.error('❌ Error creating chat', {
      userId: req.user?.sub,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to create chat',
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/:chatId
 * Get specific chat
 */
chatRouter.get('/:chatId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { chatId } = req.params;

    const chat = await chatService.getChat(chatId, userId);

    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    res.json(chat);

  } catch (error: any) {
    logger.error('❌ Error getting chat', {
      userId: req.user?.sub,
      chatId: req.params.chatId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to get chat',
      message: error.message,
    });
  }
});

/**
 * PUT /api/chat/:chatId/name
 * Update chat name
 */
chatRouter.put('/:chatId/name', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { chatId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Name is required',
      });
    }

    const chat = await chatService.updateChatName(chatId, userId, name);

    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    res.json(chat);

  } catch (error: any) {
    logger.error('❌ Error updating chat name', {
      userId: req.user?.sub,
      chatId: req.params.chatId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to update chat name',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/:chatId/pin
 * Pin/unpin chat
 */
chatRouter.post('/:chatId/pin', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { chatId } = req.params;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        error: 'isPinned must be a boolean',
      });
    }

    const chat = await chatService.updateChatPinStatus(chatId, userId, isPinned);

    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    res.json(chat);

  } catch (error: any) {
    logger.error('❌ Error updating chat pin status', {
      userId: req.user?.sub,
      chatId: req.params.chatId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to update chat pin status',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/chat/:chatId
 * Delete chat
 */
chatRouter.delete('/:chatId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { chatId } = req.params;

    const success = await chatService.deleteChat(chatId, userId);

    if (!success) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Chat deleted successfully',
    });

  } catch (error: any) {
    logger.error('❌ Error deleting chat', {
      userId: req.user?.sub,
      chatId: req.params.chatId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to delete chat',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/:chatId/clear-memory
 * Clear chat memory
 */
chatRouter.post('/:chatId/clear-memory', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const { chatId } = req.params;

    // Verify access
    const chat = await chatService.getChat(chatId, userId);
    if (!chat) {
      return res.status(404).json({
        error: 'Chat not found or access denied',
      });
    }

    await chatService.clearChatMemory(chatId);

    res.json({
      success: true,
      message: 'Chat memory cleared successfully',
    });

  } catch (error: any) {
    logger.error('❌ Error clearing chat memory', {
      userId: req.user?.sub,
      chatId: req.params.chatId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to clear chat memory',
      message: error.message,
    });
  }
});
