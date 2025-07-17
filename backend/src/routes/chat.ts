import express from 'express';
import { chatService } from '../services/chatService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all chats for the authenticated user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const chats = await chatService.getUserChats(userId);
    
    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error('❌ Error getting user chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

// Get a specific chat by ID
router.get('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    const chat = await chatService.getChat(chatId, userId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('❌ Error getting chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat'
    });
  }
});

// Create a new chat
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, agentId } = req.body;
    
    const chat = await chatService.createChat(userId, name || 'New Chat', agentId);
    
    res.status(201).json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

// Update chat name
router.put('/:chatId/name', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
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
    
    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('❌ Error updating chat name:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update chat name'
    });
  }
});

// Delete a chat
router.delete('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    const success = await chatService.deleteChat(chatId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found or access denied'
      });
    }
    
    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    res.status(500).json({
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
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics'
    });
  }
});

export default router; 