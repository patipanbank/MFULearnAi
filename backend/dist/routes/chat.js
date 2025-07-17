"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../services/chatService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const chats = await chatService_1.chatService.getUserChats(userId);
        return res.json({
            success: true,
            data: chats
        });
    }
    catch (error) {
        console.error('❌ Error getting user chats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat history'
        });
    }
});
router.get('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const chat = await chatService_1.chatService.getChat(chatId, userId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found or access denied'
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
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, agentId } = req.body;
        const chat = await chatService_1.chatService.createChat(userId, name || 'New Chat', agentId);
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
router.put('/:chatId/name', auth_1.authenticateJWT, async (req, res) => {
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
        const chat = await chatService_1.chatService.updateChatName(chatId, userId, name);
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found or access denied'
            });
        }
        return res.json({
            success: true,
            data: chat
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
router.delete('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;
        const success = await chatService_1.chatService.deleteChat(chatId, userId);
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
    }
    catch (error) {
        console.error('❌ Error deleting chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete chat'
        });
    }
});
router.get('/stats/overview', auth_1.authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const stats = chatService_1.chatService.getStats();
        return res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('❌ Error getting chat stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat statistics'
        });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map