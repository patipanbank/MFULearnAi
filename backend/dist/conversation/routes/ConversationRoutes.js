"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setConversationOrchestrator = setConversationOrchestrator;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middleware/auth");
const adminMiddleware_1 = require("../../middleware/adminMiddleware");
const types_1 = require("../types");
const router = express_1.default.Router();
let conversationOrchestrator;
function setConversationOrchestrator(orchestrator) {
    conversationOrchestrator = orchestrator;
}
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const conversations = await conversationOrchestrator.getUserConversations(userId);
        res.json({
            success: true,
            data: conversations
        });
    }
    catch (error) {
        console.error('❌ Error getting conversations:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to get conversations'
            }
        });
    }
});
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const request = req.body;
        if (!request.title || request.title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.INVALID_INPUT,
                    message: 'Title is required'
                }
            });
        }
        const conversation = await conversationOrchestrator.createConversation(userId, request);
        res.status(201).json({
            success: true,
            data: conversation
        });
    }
    catch (error) {
        console.error('❌ Error creating conversation:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to create conversation'
            }
        });
    }
});
router.get('/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        if (!conversationId || conversationId.length !== 36) {
            return res.status(400).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.INVALID_INPUT,
                    message: 'Invalid conversation ID format'
                }
            });
        }
        const conversation = await conversationOrchestrator.getConversation(conversationId, userId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.PERMISSION_DENIED,
                    message: 'Conversation not found or access denied'
                }
            });
        }
        res.json({
            success: true,
            data: conversation
        });
    }
    catch (error) {
        console.error('❌ Error getting conversation:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to get conversation'
            }
        });
    }
});
router.delete('/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const success = await conversationOrchestrator.deleteConversation(conversationId, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.PERMISSION_DENIED,
                    message: 'Conversation not found or access denied'
                }
            });
        }
        res.json({
            success: true,
            message: 'Conversation deleted successfully'
        });
    }
    catch (error) {
        console.error('❌ Error deleting conversation:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to delete conversation'
            }
        });
    }
});
router.get('/:conversationId/messages', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const messages = await conversationOrchestrator.getConversationMessages(conversationId, userId, { limit, offset });
        res.json({
            success: true,
            data: {
                messages,
                pagination: {
                    limit,
                    offset,
                    total: messages.length
                }
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting messages:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to get messages'
            }
        });
    }
});
router.post('/:conversationId/messages', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const request = req.body;
        if (!request.content || request.content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.INVALID_INPUT,
                    message: 'Message content is required'
                }
            });
        }
        if (request.content.length > 50000) {
            return res.status(400).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.INVALID_INPUT,
                    message: 'Message content is too long (max 50,000 characters)'
                }
            });
        }
        const message = await conversationOrchestrator.sendMessage(conversationId, userId, request);
        res.status(201).json({
            success: true,
            data: message
        });
    }
    catch (error) {
        console.error('❌ Error sending message:', error);
        if (error.code === types_1.ErrorCode.PERMISSION_DENIED) {
            return res.status(403).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.PERMISSION_DENIED,
                    message: error.message
                }
            });
        }
        if (error.code === types_1.ErrorCode.INVALID_INPUT) {
            return res.status(400).json({
                success: false,
                error: {
                    code: types_1.ErrorCode.INVALID_INPUT,
                    message: error.message
                }
            });
        }
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to send message'
            }
        });
    }
});
router.get('/admin/stats', auth_1.authenticateJWT, adminMiddleware_1.superAdminMiddleware, async (req, res) => {
    try {
        const stats = conversationOrchestrator.getStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('❌ Error getting admin stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: types_1.ErrorCode.INTERNAL_ERROR,
                message: 'Failed to get statistics'
            }
        });
    }
});
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'conversation-service'
    });
});
exports.default = router;
//# sourceMappingURL=ConversationRoutes.js.map