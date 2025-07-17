import express from 'express';
import { chatService } from '../services/chatService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all chats for the authenticated user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const chats = await chatService.getUserChats(userId);
    
    // Return array directly for frontend compatibility
    return res.json(chats);
  } catch (error) {
    console.error('❌ Error getting user chats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

// Get chat history (special route)
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

// Get specific chat history by session ID (must come before /:chatId route)
router.get('/history/:sessionId', authenticateJWT, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.sub || req.user.id;
    
    console.log(`📥 GET /history/${sessionId} for user: ${userId}`);
    
    // Validate sessionId format (should be 24 character hex string)
    if (!sessionId || sessionId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
      console.log(`❌ Invalid session ID format: ${sessionId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format'
      });
    }
    
    const chat = await chatService.getChat(sessionId, userId);
    
    if (!chat) {
      console.log(`❌ Chat not found or access denied: ${sessionId}`);
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    console.log(`✅ Returning chat: ${sessionId}`);
    // Return chat object directly for frontend compatibility
    return res.json(chat);
  } catch (error) {
    console.error('❌ Error getting chat history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

// Get a specific chat by ID (must come after /history route)
router.get('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    
    // Validate chatId format (should be 24 character hex string)
    if (!chatId || chatId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(chatId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat ID format'
      });
    }
    
    const chat = await chatService.getChat(chatId, userId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    // Return chat object directly for frontend compatibility
    return res.json(chat);
  } catch (error) {
    console.error('❌ Error getting chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat'
    });
  }
});

// Create a new chat
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { name, agentId } = req.body;
    
    const chat = await chatService.createChat(userId, name || 'New Chat', agentId);
    
    // Return chat object directly for frontend compatibility
    return res.status(201).json(chat);
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

// Update chat name
router.put('/:chatId/name', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }
    
    const chat = await chatService.updateChatName(chatId, userId, name);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    // Return chat object directly for frontend compatibility
    return res.json(chat);
  } catch (error) {
    console.error('❌ Error updating chat name:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update chat name'
    });
  }
});

// Pin/unpin a chat
router.post('/:chatId/pin', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const { isPinned } = req.body;
    
    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isPinned must be a boolean'
      });
    }
    
    const chat = await chatService.updateChatPinStatus(chatId, userId, isPinned);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    return res.json(chat);
  } catch (error) {
    console.error('❌ Error updating chat pin status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update chat pin status'
    });
  }
});

// Clear chat memory
router.post('/:chatId/clear-memory', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    
    // Verify user has access to this chat
    const chat = await chatService.getChat(chatId, userId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    await chatService.clearChatMemory(chatId);
    
    return res.json({
      success: true,
      message: 'Chat memory cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing chat memory:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear chat memory'
    });
  }
});

// Delete a chat
router.delete('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    
    const success = await chatService.deleteChat(chatId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
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
      error: 'Failed to delete chat'
    });
  }
});

// Get chat statistics (admin only)
router.get('/stats/overview', authenticateJWT, async (req: any, res) => {
  try {
    // Check if user is admin (you can implement role-based access control here)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const stats = chatService.getStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting chat stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics'
    });
  }
});

export default router; 