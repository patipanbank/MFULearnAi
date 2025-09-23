"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middleware/auth");
const adminMiddleware_1 = require("../../middleware/adminMiddleware");
const LangGraphConversation_1 = require("../LangGraphConversation");
const models_1 = require("../models");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const conversations = await models_1.ConversationModel
            .find({ userId })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        const formattedConversations = conversations.map(conv => ({
            _id: conv._id,
            id: conv.id || conv._id,
            userId: conv.userId,
            name: conv.title,
            title: conv.title,
            agentId: conv.agentId,
            isPinned: conv.pinned || false,
            messages: [],
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        }));
        return res.json(formattedConversations);
    }
    catch (error) {
        console.error('❌ Error getting conversations:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get conversations'
        });
    }
});
router.get('/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const conversations = await models_1.ConversationModel
            .find({ userId })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        return res.json(conversations);
    }
    catch (error) {
        console.error('❌ Error getting conversation history:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get conversation history'
        });
    }
});
router.get('/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const conversation = await models_1.ConversationModel
            .findOne({
            $or: [
                { id: conversationId },
                { _id: conversationId }
            ],
            userId
        })
            .lean();
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        const messages = await models_1.ConversationMessageModel
            .find({ conversationId: conversation.id || conversationId })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();
        const formattedConversation = {
            _id: conversation._id,
            id: conversation.id || conversation._id,
            userId: conversation.userId,
            name: conversation.title,
            title: conversation.title,
            agentId: conversation.agentId,
            isPinned: conversation.pinned || false,
            messages: messages.map(msg => ({
                id: msg.id || msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.createdAt,
                isStreaming: false
            })),
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
        return res.json(formattedConversation);
    }
    catch (error) {
        console.error('❌ Error getting conversation:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get conversation'
        });
    }
});
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { name, agentId } = req.body;
        const conversationId = (0, uuid_1.v4)();
        const conversation = new models_1.ConversationModel({
            id: conversationId,
            userId,
            title: name || 'New Conversation',
            status: 'active',
            agentId,
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            systemPrompt: 'You are a helpful AI assistant.',
            temperature: 0.7,
            maxTokens: 4000,
            collectionNames: [],
            metadata: {
                messageCount: 0,
                totalTokens: 0,
                averageResponseTime: 0
            },
            pinned: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await conversation.save();
        const formattedConversation = {
            _id: conversation._id,
            id: conversation.id,
            userId: conversation.userId,
            name: conversation.title,
            title: conversation.title,
            agentId: conversation.agentId,
            isPinned: false,
            messages: [],
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
        console.log(`✅ Created conversation ${conversation.id} for user ${userId}`);
        return res.status(201).json(formattedConversation);
    }
    catch (error) {
        console.error('❌ Error creating conversation:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create conversation'
        });
    }
});
router.put('/:conversationId/name', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const { name } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }
        const conversation = await models_1.ConversationModel.findOneAndUpdate({
            $or: [{ id: conversationId }, { _id: conversationId }],
            userId
        }, {
            title: name.trim(),
            updatedAt: new Date()
        }, { new: true });
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        return res.json({
            success: true,
            message: 'Conversation name updated'
        });
    }
    catch (error) {
        console.error('❌ Error updating conversation name:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update conversation name'
        });
    }
});
router.post('/:conversationId/pin', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const { pinned } = req.body;
        const conversation = await models_1.ConversationModel.findOneAndUpdate({
            $or: [{ id: conversationId }, { _id: conversationId }],
            userId
        }, {
            pinned: !!pinned,
            updatedAt: new Date()
        }, { new: true });
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        return res.json({
            success: true,
            message: pinned ? 'Conversation pinned' : 'Conversation unpinned'
        });
    }
    catch (error) {
        console.error('❌ Error updating conversation pin status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update conversation pin status'
        });
    }
});
router.post('/:conversationId/clear-memory', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const conversation = await models_1.ConversationModel.findOne({
            $or: [{ id: conversationId }, { _id: conversationId }],
            userId
        });
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        await LangGraphConversation_1.langGraphConversationService.clearConversation(conversationId);
        return res.json({
            success: true,
            message: 'Conversation memory cleared'
        });
    }
    catch (error) {
        console.error('❌ Error clearing conversation memory:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear conversation memory'
        });
    }
});
router.delete('/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { conversationId } = req.params;
        const deletedConversation = await models_1.ConversationModel.findOneAndDelete({
            $or: [{ id: conversationId }, { _id: conversationId }],
            userId
        });
        if (!deletedConversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversation not found'
            });
        }
        await models_1.ConversationMessageModel.deleteMany({
            conversationId: deletedConversation.id || conversationId
        });
        await LangGraphConversation_1.langGraphConversationService.clearConversation(conversationId);
        return res.json({
            success: true,
            message: 'Conversation deleted'
        });
    }
    catch (error) {
        console.error('❌ Error deleting conversation:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete conversation'
        });
    }
});
router.get('/stats/overview', auth_1.authenticateJWT, adminMiddleware_1.superAdminMiddleware, async (req, res) => {
    try {
        const [conversationCount, messageCount, activeUsers] = await Promise.all([
            models_1.ConversationModel.countDocuments(),
            models_1.ConversationMessageModel.countDocuments(),
            models_1.ConversationModel.distinct('userId').then(users => users.length)
        ]);
        const stats = {
            totalConversations: conversationCount,
            totalMessages: messageCount,
            activeUsers,
            system: 'langgraph'
        };
        return res.json(stats);
    }
    catch (error) {
        console.error('❌ Error getting admin stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get statistics'
        });
    }
});
router.post('/update-name', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { chatId, name } = req.body;
        req.params.conversationId = chatId;
        req.body.name = name;
        return router.put('/:conversationId/name')(req, res);
    }
    catch (error) {
        console.error('❌ Error in legacy update-name:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update name'
        });
    }
});
exports.default = router;
//# sourceMappingURL=ConversationHttpRoutes.js.map