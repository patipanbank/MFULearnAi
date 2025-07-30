"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const chatService_1 = require("../services/chatService");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const chats = await chatService_1.chatService.getChatsByUser(userId);
        return res.json({
            success: true,
            data: chats
        });
    }
    catch (error) {
        console.error('❌ Error getting chats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chats'
        });
    }
});
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { name, agentId, initialMessage } = req.body;
        const userId = req.user.id;
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Chat name is required'
            });
        }
        const chat = await chatService_1.chatService.createChat(userId, name, agentId, initialMessage);
        return res.status(201).json({
            success: true,
            data: chat
        });
    }
    catch (error) {
        console.error('❌ Error creating chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create chat'
        });
    }
});
router.get('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found'
            });
        }
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
    }
    catch (error) {
        console.error('❌ Error getting chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat'
        });
    }
});
router.post('/messages/:chatId', auth_1.authenticateJWT, async (req, res) => {
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
        const chat = await chatService_1.chatService.getChat(chatId);
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
        await chatService_1.chatService.processMessage(chatId, userId, message, images);
        return res.json({
            success: true,
            message: 'Message sent successfully'
        });
    }
    catch (error) {
        console.error('❌ Error sending message:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});
router.put('/name/:chatId', auth_1.authenticateJWT, async (req, res) => {
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
        const chat = await chatService_1.chatService.getChat(chatId);
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
        const updatedChat = await chatService_1.chatService.updateChatName(chatId, name);
        return res.json({
            success: true,
            data: updatedChat
        });
    }
    catch (error) {
        console.error('❌ Error updating chat name:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update chat name'
        });
    }
});
router.put('/pin/:chatId', auth_1.authenticateJWT, async (req, res) => {
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
        const chat = await chatService_1.chatService.getChat(chatId);
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
        const success = await chatService_1.chatService.updateChatPinStatus(chatId, isPinned);
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
    }
    catch (error) {
        console.error('❌ Error updating chat pin status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update chat pin status'
        });
    }
});
router.delete('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId);
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
        await chatService_1.chatService.deleteChat(chatId);
        return res.json({
            success: true,
            message: 'Chat deleted successfully'
        });
    }
    catch (error) {
        console.error('❌ Error deleting chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete chat'
        });
    }
});
router.post('/clear/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId);
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
        const success = await chatService_1.chatService.clearChatMemory(chatId);
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
    }
    catch (error) {
        console.error('❌ Error clearing chat memory:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear chat memory'
        });
    }
});
router.get('/messages/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId);
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
        const messages = await chatService_1.chatService.getChatMessages(chatId, parseInt(page), parseInt(limit));
        return res.json({
            success: true,
            data: messages
        });
    }
    catch (error) {
        console.error('❌ Error getting chat messages:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat messages'
        });
    }
});
router.delete('/messages/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId);
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
        await chatService_1.chatService.clearChatMessages(chatId);
        return res.json({
            success: true,
            message: 'Chat messages cleared successfully'
        });
    }
    catch (error) {
        console.error('❌ Error clearing chat messages:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear chat messages'
        });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map