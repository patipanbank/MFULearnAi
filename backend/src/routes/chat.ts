import express from 'express';
import { chatService } from '../services/chatService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all chats for user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const chats = await chatService.getUserChats(userId);
    
    return res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error('❌ Error getting user chats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user chats'
    });
  }
});

// Create new chat
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { agentId, name } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required'
      });
    }

    const chat = await chatService.createChat(userId, agentId, name);
    
    return res.status(201).json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

// Get specific chat
router.get('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const chat = await chatService.getChat(chatId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Check ownership
    if (chat.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
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
      error: 'Failed to get chat'
    });
  }
});

// Send message to chat
router.post('/:chatId/messages', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const { message, images } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Process message (this will handle WebSocket broadcasting)
    await chatService.processMessage(chatId, userId, message, images);
    
    return res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Update chat name
router.put('/:chatId/name', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const success = await chatService.updateChatName(chatId, name);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update chat name'
      });
    }
    
    return res.json({
      success: true,
      message: 'Chat name updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating chat name:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update chat name'
    });
  }
});

// Update chat pin status
router.put('/:chatId/pin', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const { isPinned } = req.body;
    const userId = req.user.id;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isPinned must be a boolean'
      });
    }

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const success = await chatService.updateChatPinStatus(chatId, isPinned);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update chat pin status'
      });
    }
    
    return res.json({
      success: true,
      message: 'Chat pin status updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating chat pin status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update chat pin status'
    });
  }
});

// Get chat messages
router.get('/:chatId/messages', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    return res.json({
      success: true,
      data: chat.messages
    });
  } catch (error) {
    console.error('❌ Error getting chat messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat messages'
    });
  }
});

// Delete chat
router.delete('/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const success = await chatService.deleteChat(chatId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete chat'
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

// Clear chat memory
router.post('/:chatId/clear', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const success = await chatService.clearChatMemory(chatId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to clear chat memory'
      });
    }
    
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

export default router; 