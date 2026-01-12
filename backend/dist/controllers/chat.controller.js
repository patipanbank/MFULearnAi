"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollections = exports.addMessage = exports.editMessage = exports.parseFile = exports.getUsage = exports.togglePinChat = exports.renameChat = exports.validateRenameChat = exports.clearHistory = exports.importChat = exports.exportChat = exports.deleteChat = exports.updateChat = exports.getChat = exports.getChats = exports.saveHistory = exports.streamChat = exports.uploadMiddleware = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const express_validator_1 = require("express-validator");
const multer_1 = __importDefault(require("multer"));
const chat_1 = require("../services/chat");
const usage_service_1 = require("../services/usage.service");
const fileParser_1 = require("../services/fileParser");
const Collection_1 = require("../models/Collection");
const Chat_1 = require("../models/Chat");
const errors_1 = require("../errors");
const errorHandler_1 = require("../middleware/errorHandler");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
// Multer configuration
const storage = multer_1.default.memoryStorage();
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
/**
 * Get user from request or throw error
 */
const getUserId = (req) => {
    const userId = req.user?.username;
    if (!userId) {
        throw new errors_1.UnauthorizedError('User not authenticated');
    }
    return userId;
};
/**
 * Validate MongoDB ObjectId format
 */
const validateObjectId = (id) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new errors_1.BadRequestError('Invalid ID format');
    }
};
/**
 * POST /api/chat - SSE chat endpoint
 */
exports.streamChat = authHandler(async (req, res, _next) => {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Initial ping
    res.write(':\n\n');
    const { messages, modelId, collectionName } = req.body;
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;
    const sendChunk = (content) => {
        const data = JSON.stringify({ content });
        res.write(`data: ${data}\n\n`);
    };
    // Start stream
    sendChunk('');
    try {
        for await (const content of chat_1.chatService.generateResponse(messages, query, modelId, collectionName)) {
            sendChunk(content);
        }
    }
    catch (error) {
        console.error('Error in stream generation:', error);
        sendChunk('\nSorry, an error occurred. Please try again.');
    }
    res.end();
});
/**
 * POST /api/chat/history - Save chat history
 */
exports.saveHistory = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { messages, modelId } = req.body;
    if (!messages || !Array.isArray(messages)) {
        throw new errors_1.BadRequestError('Invalid messages format');
    }
    if (!modelId) {
        throw new errors_1.BadRequestError('ModelId is required');
    }
    const chat = await chat_1.chatService.saveChat(userId, modelId, messages);
    res.json(chat);
});
/**
 * GET /api/chat/chats - Get user's chats
 */
exports.getChats = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const chats = await chat_1.chatService.getChats(userId, page, limit);
    res.json(chats);
});
/**
 * GET /api/chat/chats/:chatId - Get specific chat
 */
exports.getChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { chatId } = req.params;
    validateObjectId(chatId);
    const chat = await chat_1.chatService.getChat(userId, chatId);
    res.json(chat);
});
/**
 * PUT /api/chat/history/:chatId - Update chat
 */
exports.updateChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { chatId } = req.params;
    const { messages } = req.body;
    validateObjectId(chatId);
    const updatedChat = await chat_1.chatService.updateChat(chatId, userId, messages);
    res.json(updatedChat);
});
/**
 * DELETE /api/chat/history/:chatId - Delete chat
 */
exports.deleteChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { chatId } = req.params;
    validateObjectId(chatId);
    await chat_1.chatService.deleteChat(chatId, userId);
    res.json({ success: true, message: 'Chat deleted successfully' });
});
/**
 * GET /api/chat/history/:chatId/export - Export chat
 */
exports.exportChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { chatId } = req.params;
    validateObjectId(chatId);
    const chat = await chat_1.chatService.getChat(userId, chatId);
    res.json(chat);
});
/**
 * POST /api/chat/history/import - Import chat
 */
exports.importChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { messages } = req.body;
    const importedChat = await chat_1.chatService.saveChat(userId, 'default', messages);
    res.json(importedChat);
});
/**
 * DELETE /api/chat/clear - Clear all chat history
 */
exports.clearHistory = authHandler(async (req, res) => {
    const userId = getUserId(req);
    await Chat_1.Chat.deleteMany({ userId });
    res.json({ success: true, message: 'Chat history cleared successfully' });
});
/**
 * Validation for rename chat
 */
exports.validateRenameChat = [
    (0, express_validator_1.body)('newName')
        .trim()
        .notEmpty().withMessage('Chat name cannot be empty')
        .isLength({ max: 100 }).withMessage('Chat name too long (max 100 characters)')
        .matches(/^[^<>]*$/).withMessage('Chat name contains invalid characters'),
];
/**
 * PUT /api/chat/history/:chatId/rename - Rename chat
 */
exports.renameChat = authHandler(async (req, res) => {
    // Check validation errors
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        throw new errors_1.BadRequestError('Validation failed', errors.array());
    }
    const userId = getUserId(req);
    const { chatId } = req.params;
    const { newName } = req.body;
    validateObjectId(chatId);
    const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
    if (!chat) {
        throw new errors_1.NotFoundError('Chat not found or unauthorized');
    }
    chat.chatname = newName.trim();
    chat.updatedAt = new Date();
    await chat.save();
    res.json({
        success: true,
        chat: {
            id: chat._id,
            chatname: chat.chatname,
            updatedAt: chat.updatedAt,
        },
    });
});
/**
 * PUT /api/chat/history/:chatId/pin - Toggle pin status
 */
exports.togglePinChat = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const { chatId } = req.params;
    validateObjectId(chatId);
    // Verify chat exists
    await chat_1.chatService.getChat(userId, chatId);
    const updatedChat = await chat_1.chatService.togglePinChat(chatId, userId);
    res.json(updatedChat);
});
/**
 * GET /api/chat/usage - Get user usage info
 */
exports.getUsage = authHandler(async (req, res) => {
    const userId = getUserId(req);
    const usage = await usage_service_1.usageService.getUserUsage(userId);
    res.json(usage);
});
/**
 * POST /api/chat/parse-file - Parse uploaded file
 */
exports.parseFile = authHandler(async (req, res) => {
    if (!req.file) {
        throw new errors_1.BadRequestError('No file uploaded');
    }
    const text = await fileParser_1.fileParserService.parseFile(req.file);
    res.json({ text });
});
/**
 * POST /api/chat/edit-message - Edit message in chat
 */
exports.editMessage = authHandler(async (req, res) => {
    const { chatId, messageId, content, role, isEdited } = req.body;
    const userId = getUserId(req);
    if (!chatId) {
        throw new errors_1.BadRequestError('Invalid chat ID');
    }
    validateObjectId(chatId);
    if (!messageId) {
        throw new errors_1.BadRequestError('Message ID is required');
    }
    if (!content) {
        throw new errors_1.BadRequestError('Content is required');
    }
    const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
    if (!chat) {
        throw new errors_1.NotFoundError('Chat not found or unauthorized');
    }
    const messageIdStr = String(messageId);
    const messageIndex = chat.messages.findIndex(m => String(m.id) === messageIdStr);
    if (messageIndex === -1) {
        throw new errors_1.NotFoundError('Message not found');
    }
    chat.messages[messageIndex].content = content;
    if (role === 'assistant' && isEdited) {
        try {
            chat.messages[messageIndex].set('isEdited', true);
        }
        catch {
            // Ignore if field doesn't exist in schema
        }
    }
    await chat.save();
    res.json({ success: true });
});
/**
 * POST /api/chat/history/:chatId/messages - Add message to chat
 */
exports.addMessage = authHandler(async (req, res) => {
    const { chatId } = req.params;
    const { message } = req.body;
    const userId = getUserId(req);
    validateObjectId(chatId);
    if (!message || !message.content || !message.role) {
        throw new errors_1.BadRequestError('Message content and role are required');
    }
    const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
    if (!chat) {
        throw new errors_1.NotFoundError('Chat not found or unauthorized');
    }
    const newMessage = {
        id: message.id || Date.now(),
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || { $date: new Date().toISOString() },
    };
    if (message.files && Array.isArray(message.files) && message.files.length > 0) {
        newMessage.files = message.files;
    }
    chat.messages.push(newMessage);
    await chat.save();
    res.json({ success: true });
});
/**
 * GET /api/chat/collections - Get accessible collections
 */
exports.getCollections = authHandler(async (req, res) => {
    const user = req.user;
    const collections = await Collection_1.CollectionModel.find({});
    // Admin can access all collections
    if (user.groups.includes('Admin') || user.groups.includes('SuperAdmin')) {
        res.json(collections.map(c => c.name));
        return;
    }
    // Filter by permission
    const accessibleCollections = collections.filter(collection => {
        switch (collection.permission) {
            case Collection_1.CollectionPermission.PUBLIC:
                return true;
            case Collection_1.CollectionPermission.PRIVATE:
                return collection.createdBy === user.nameID;
            default:
                return false;
        }
    });
    res.json(accessibleCollections.map(c => c.name));
});
