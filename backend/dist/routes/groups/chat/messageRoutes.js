"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../../../services/chatService");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const zod_1 = require("zod");
const router = express_1.default.Router();
exports.messageRoutes = router;
const sendMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        chatId: zod_1.z.string(),
        content: zod_1.z.string().min(1),
        role: zod_1.z.enum(['user', 'assistant', 'system']).optional().default('user'),
        images: zod_1.z.array(zod_1.z.object({
            url: zod_1.z.string(),
            mediaType: zod_1.z.string()
        })).optional()
    })
});
const updateMessageSchema = zod_1.z.object({
    params: zod_1.z.object({
        messageId: zod_1.z.string()
    }),
    body: zod_1.z.object({
        content: zod_1.z.string().min(1).optional(),
        isComplete: zod_1.z.boolean().optional(),
        toolUsage: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.enum(['tool_start', 'tool_result', 'tool_error']),
            tool_name: zod_1.z.string(),
            tool_input: zod_1.z.string().optional(),
            output: zod_1.z.string().optional(),
            error: zod_1.z.string().optional()
        })).optional()
    })
});
router.get('/:chatId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const { limit, offset, before, after } = req.query;
        const messages = await chatService_1.chatService.getChatMessages(chatId, userId, {
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
            before,
            after
        });
        return res.json({
            success: true,
            data: messages,
            meta: {
                chatId,
                total: messages.length,
                limit: limit ? parseInt(limit) : null,
                offset: offset ? parseInt(offset) : 0
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting messages:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get messages',
            code: 'MESSAGES_FETCH_ERROR'
        });
    }
});
router.post('/', auth_1.authenticateJWT, (0, validation_1.validateRequest)(sendMessageSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId, content, role, images } = req.body;
        const message = await chatService_1.chatService.addMessage(chatId, {
            content,
            role,
            images
        });
        return res.status(201).json({
            success: true,
            data: message,
            message: 'Message sent successfully'
        });
    }
    catch (error) {
        console.error('❌ Error sending message:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send message',
            code: 'MESSAGE_SEND_ERROR'
        });
    }
});
router.put('/:messageId', auth_1.authenticateJWT, (0, validation_1.validateRequest)(updateMessageSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { messageId } = req.params;
        const updates = req.body;
        const message = await chatService_1.chatService.updateMessage(messageId, updates);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found',
                code: 'MESSAGE_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: message,
            message: 'Message updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error updating message:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update message',
            code: 'MESSAGE_UPDATE_ERROR'
        });
    }
});
router.delete('/:messageId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { messageId } = req.params;
        const success = await chatService_1.chatService.deleteMessage(messageId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Message not found',
                code: 'MESSAGE_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    }
    catch (error) {
        console.error('❌ Error deleting message:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete message',
            code: 'MESSAGE_DELETE_ERROR'
        });
    }
});
router.get('/:chatId/search', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const { query, role, dateFrom, dateTo } = req.query;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required',
                code: 'MISSING_QUERY'
            });
        }
        const messages = await chatService_1.chatService.searchMessages(chatId, {
            query,
            role,
            dateFrom,
            dateTo
        });
        return res.json({
            success: true,
            data: messages,
            meta: {
                chatId,
                query,
                total: messages.length
            }
        });
    }
    catch (error) {
        console.error('❌ Error searching messages:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search messages',
            code: 'MESSAGE_SEARCH_ERROR'
        });
    }
});
router.get('/:chatId/export', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { chatId } = req.params;
        const { format = 'json' } = req.query;
        const messages = await chatService_1.chatService.getChatMessages(chatId, userId);
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}-messages.json"`);
            return res.json(messages);
        }
        else if (format === 'txt') {
            const txtContent = messages.map(msg => `[${msg.timestamp}] ${msg.role}: ${msg.content}`).join('\n\n');
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="chat-${chatId}-messages.txt"`);
            return res.send(txtContent);
        }
        else {
            return res.status(400).json({
                success: false,
                error: 'Unsupported export format',
                code: 'UNSUPPORTED_FORMAT'
            });
        }
    }
    catch (error) {
        console.error('❌ Error exporting messages:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to export messages',
            code: 'MESSAGE_EXPORT_ERROR'
        });
    }
});
//# sourceMappingURL=messageRoutes.js.map