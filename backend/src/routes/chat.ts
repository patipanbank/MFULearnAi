import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { chatService } from '../services/chatService';

const router = Router();

// Get all chats for user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const chats = await chatService.getChatsByUser(userId);
    
    return res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error('❌ Error getting chats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chats'
    });
  }
});

// Create new chat
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const { name, agentId, initialMessage } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Chat name is required'
      });
    }

    const chat = await chatService.createChat(userId, name, agentId, initialMessage);
    
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
    const userId = req.user.id;

    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    // Check ownership
    if (chat.userId?.toString() !== req.user.id) {
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
router.post('/messages/:chatId', authenticateJWT, async (req: any, res) => {
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

    if (chat.userId?.toString() !== userId) {
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
router.put('/name/:chatId', authenticateJWT, async (req: any, res) => {
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

    if (chat.userId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedChat = await chatService.updateChatName(chatId, name);
    
    return res.json({
      success: true,
      data: updatedChat
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
router.put('/pin/:chatId', authenticateJWT, async (req: any, res) => {
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

    if (chat.userId?.toString() !== userId) {
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

    if (chat.userId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await chatService.deleteChat(chatId);
    
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
router.post('/clear/:chatId', authenticateJWT, async (req: any, res) => {
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

    if (chat.userId?.toString() !== userId) {
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

// Get chat messages
router.get('/messages/:chatId', authenticateJWT, async (req: any, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    // Check if chat exists and user owns it
    const chat = await chatService.getChat(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    if (chat.userId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const messages = await chatService.getChatMessages(chatId, parseInt(page as string), parseInt(limit as string));
    
    return res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('❌ Error getting chat messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get chat messages'
    });
  }
});

// Clear chat messages
router.delete('/messages/:chatId', authenticateJWT, async (req: any, res) => {
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

    if (chat.userId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await chatService.clearChatMessages(chatId);
    
    return res.json({
      success: true,
      message: 'Chat messages cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing chat messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear chat messages'
    });
  }
});

export default router; 