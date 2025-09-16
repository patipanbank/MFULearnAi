"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../services/chatService");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../utils/errorHandler");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub || req.user.id;
    const chats = await chatService_1.chatService.getUserChats(userId);
    return res.json(chats);
}));
router.get('/history', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub || req.user.id;
    const chats = await chatService_1.chatService.getUserChats(userId);
    return res.json(chats);
}));
router.get('/history/:sessionId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.sub || req.user.id;
    console.log(`📥 GET /history/${sessionId} for user: ${userId}`);
    if (!sessionId || sessionId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
        console.log(`❌ Invalid session ID format: ${sessionId}`);
        throw (0, errorHandler_1.validationError)('Invalid session ID format');
    }
    const chat = await chatService_1.chatService.getChat(sessionId, userId);
    if (!chat) {
        console.log(`❌ Chat not found or access denied: ${sessionId}`);
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    console.log(`✅ Returning chat: ${sessionId}`);
    return res.json(chat);
}));
router.get('/:chatId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    if (!chatId || chatId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(chatId)) {
        throw (0, errorHandler_1.validationError)('Invalid chat ID format');
    }
    const chat = await chatService_1.chatService.getChat(chatId, userId);
    if (!chat) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json(chat);
}));
router.post('/', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub || req.user.id;
    const { name, agentId } = req.body;
    const chat = await chatService_1.chatService.createChat(userId, name || 'New Chat', agentId);
    return res.status(201).json(chat);
}));
router.post('/update-name', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chat_id, name } = req.body;
    const userId = req.user.sub || req.user.id;
    if (!chat_id || !name || typeof name !== 'string') {
        throw (0, errorHandler_1.validationError)('chat_id and name are required');
    }
    const chat = await chatService_1.chatService.updateChatName(chat_id, userId, name);
    if (!chat) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json(chat);
}));
router.put('/:chatId/name', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
        throw (0, errorHandler_1.validationError)('Name is required');
    }
    const chat = await chatService_1.chatService.updateChatName(chatId, userId, name);
    if (!chat) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json(chat);
}));
router.post('/:chatId/pin', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') {
        throw (0, errorHandler_1.validationError)('isPinned must be a boolean');
    }
    const chat = await chatService_1.chatService.updateChatPinStatus(chatId, userId, isPinned);
    if (!chat) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json(chat);
}));
router.post('/:chatId/clear-memory', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const chat = await chatService_1.chatService.getChat(chatId, userId);
    if (!chat) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    await chatService_1.chatService.clearChatMemory(chatId);
    return res.json({
        success: true,
        message: 'Chat memory cleared successfully'
    });
}));
router.delete('/:chatId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const success = await chatService_1.chatService.deleteChat(chatId, userId);
    if (!success) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json({
        success: true,
        message: 'Chat deleted successfully'
    });
}));
router.get('/trash', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub || req.user.id;
    const deletedChats = await chatService_1.chatService.getUserDeletedChats(userId);
    return res.json(deletedChats);
}));
router.post('/:chatId/restore', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const restoredChat = await chatService_1.chatService.restoreChat(chatId, userId);
    if (!restoredChat) {
        throw (0, errorHandler_1.notFoundError)('Deleted chat');
    }
    return res.json({
        success: true,
        message: 'Chat restored successfully',
        chat: restoredChat
    });
}));
router.delete('/:chatId/permanent', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user.sub || req.user.id;
    const success = await chatService_1.chatService.permanentlyDeleteChat(chatId, userId);
    if (!success) {
        throw (0, errorHandler_1.notFoundError)('Chat');
    }
    return res.json({
        success: true,
        message: 'Chat permanently deleted'
    });
}));
router.delete('/:chatId/messages/:messageId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId, messageId } = req.params;
    const userId = req.user.sub || req.user.id;
    const success = await chatService_1.chatService.deleteMessage(chatId, messageId, userId);
    if (!success) {
        throw (0, errorHandler_1.notFoundError)('Message');
    }
    return res.json({
        success: true,
        message: 'Message deleted successfully'
    });
}));
router.post('/:chatId/messages/:messageId/restore', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { chatId, messageId } = req.params;
    const userId = req.user.sub || req.user.id;
    const success = await chatService_1.chatService.restoreMessage(chatId, messageId, userId);
    if (!success) {
        throw (0, errorHandler_1.notFoundError)('Deleted message');
    }
    return res.json({
        success: true,
        message: 'Message restored successfully'
    });
}));
router.get('/memory/stats', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw (0, errorHandler_1.forbiddenError)();
    }
    const stats = chatService_1.chatService.getStats();
    return res.json({
        success: true,
        data: stats
    });
}));
router.get('/stats/overview', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw (0, errorHandler_1.forbiddenError)();
    }
    const stats = chatService_1.chatService.getStats();
    return res.json({
        success: true,
        data: stats
    });
}));
router.get('/stats/agent-cache', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw (0, errorHandler_1.forbiddenError)();
    }
    const cacheStats = chatService_1.chatService.getAgentCacheStats();
    return res.json({
        success: true,
        data: cacheStats
    });
}));
router.post('/stats/agent-cache/clear', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw (0, errorHandler_1.forbiddenError)();
    }
    chatService_1.chatService.clearAgentCache();
    return res.json({
        success: true,
        message: 'Agent cache cleared successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=chat.js.map