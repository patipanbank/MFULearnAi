"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../../../services/chatService");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const zod_1 = require("zod");
const router = express_1.default.Router();
exports.chatRoutes = router;
const createChatSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        agentId: zod_1.z.string(),
        initialMessage: zod_1.z.string().optional()
    })
});
const updateChatSchema = zod_1.z.object({
    params: zod_1.z.object({
        chatId: zod_1.z.string()
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100).optional(),
        isPinned: zod_1.z.boolean().optional()
    })
});
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { limit, offset, search, agentId } = req.query;
        const chats = await chatService_1.chatService.getUserChats(userId);
        return res.json({
            success: true,
            data: chats,
            meta: {
                total: chats.length,
                limit: limit ? parseInt(limit) : null,
                offset: offset ? parseInt(offset) : 0
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting user chats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat history',
            code: 'CHAT_FETCH_ERROR'
        });
    }
});
router.get('/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const chats = await chatService_1.chatService.getUserChats(userId);
        return res.json(chats);
    }
    catch (error) {
        console.error('❌ Error getting chat history:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat history'
        });
    }
});
router.get('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const chat = await chatService_1.chatService.getChatWithMessages(chatId, userId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found',
                code: 'CHAT_NOT_FOUND'
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
            error: 'Failed to get chat',
            code: 'CHAT_FETCH_ERROR'
        });
    }
});
router.post('/', auth_1.authenticateJWT, (0, validation_1.validateRequest)(createChatSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { name, agentId, initialMessage } = req.body;
        const chat = await chatService_1.chatService.createChat(name, agentId, userId);
        return res.status(201).json({
            success: true,
            data: chat,
            message: 'Chat created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error creating chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create chat',
            code: 'CHAT_CREATE_ERROR'
        });
    }
});
router.put('/:chatId', auth_1.authenticateJWT, (0, validation_1.validateRequest)(updateChatSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const updates = req.body;
        const chat = await chatService_1.chatService.updateChat(chatId, updates);
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found',
                code: 'CHAT_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: chat,
            message: 'Chat updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error updating chat:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update chat',
            code: 'CHAT_UPDATE_ERROR'
        });
    }
});
router.delete('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const success = await chatService_1.chatService.deleteChat(chatId, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found',
                code: 'CHAT_NOT_FOUND'
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
            error: 'Failed to delete chat',
            code: 'CHAT_DELETE_ERROR'
        });
    }
});
router.post('/batch', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { operation, chatIds } = req.body;
        let result;
        switch (operation) {
            case 'delete':
                result = await chatService_1.chatService.batchDeleteChats(chatIds);
                break;
            case 'pin':
                result = await chatService_1.chatService.batchPinChats(chatIds, true);
                break;
            case 'unpin':
                result = await chatService_1.chatService.batchPinChats(chatIds, false);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid batch operation',
                    code: 'INVALID_OPERATION'
                });
        }
        return res.json({
            success: true,
            data: result,
            message: `Batch ${operation} completed successfully`
        });
    }
    catch (error) {
        console.error('❌ Error in batch operation:', error);
        return res.status(500).json({
            success: false,
            error: 'Batch operation failed',
            code: 'BATCH_OPERATION_ERROR'
        });
    }
});
//# sourceMappingURL=chatRoutes.js.map