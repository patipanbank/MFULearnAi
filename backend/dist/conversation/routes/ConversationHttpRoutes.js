"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const Conversation_1 = require("../models/Conversation");
const ConversationMessage_1 = require("../models/ConversationMessage");
const router = (0, express_1.Router)();
router.get('/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 50, search, status, dateFrom, dateTo, agentId, sortBy = 'updatedAt', sortOrder = 'desc', pinned } = req.query;
        const query = { userId };
        if (status) {
            query.status = status;
        }
        if (agentId) {
            query.agentId = agentId;
        }
        if (pinned !== undefined) {
            query['metadata.isPinned'] = pinned === 'true';
        }
        if (dateFrom || dateTo) {
            query.updatedAt = {};
            if (dateFrom) {
                query.updatedAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.updatedAt.$lte = new Date(dateTo);
            }
        }
        if (search) {
            query.$text = { $search: search };
        }
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 50, 100);
        const skip = (pageNum - 1) * limitNum;
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        const [conversations, totalCount] = await Promise.all([
            Conversation_1.ConversationModel.aggregate([
                { $match: query },
                { $sort: sort },
                { $skip: skip },
                { $limit: limitNum },
                {
                    $addFields: {
                        id: '$_id'
                    }
                },
                {
                    $project: {
                        _id: 0,
                        id: 1,
                        userId: 1,
                        title: 1,
                        status: 1,
                        agentId: 1,
                        modelId: 1,
                        metadata: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        lastMessageAt: 1
                    }
                }
            ]),
            Conversation_1.ConversationModel.countDocuments(query)
        ]);
        const response = {
            conversations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                pages: Math.ceil(totalCount / limitNum)
            },
            filters: {
                search,
                status,
                dateFrom,
                dateTo,
                agentId,
                pinned
            }
        };
        return res.json(response);
    }
    catch (error) {
        console.error('❌ Error fetching conversation history:', error);
        return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
});
router.get('/history/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const conversation = await Conversation_1.ConversationModel.findOne({
            _id: conversationId,
            userId
        }).lean();
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        const messages = await ConversationMessage_1.ConversationMessageModel.find({
            conversationId
        }).sort({ timestamp: 1 }).lean();
        const response = {
            ...conversation,
            id: conversation._id,
            messages: messages.map((msg) => ({
                id: msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                images: msg.images || [],
                isStreaming: false,
                isComplete: true,
                toolUsage: msg.toolUsage || []
            }))
        };
        return res.json(response);
    }
    catch (error) {
        console.error('❌ Error fetching conversation:', error);
        return res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});
router.delete('/history/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const conversation = await Conversation_1.ConversationModel.findOne({
            _id: conversationId,
            userId
        });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        await Promise.all([
            Conversation_1.ConversationModel.deleteOne({ _id: conversationId }),
            ConversationMessage_1.ConversationMessageModel.deleteMany({ conversationId })
        ]);
        return res.json({ success: true });
    }
    catch (error) {
        console.error('❌ Error deleting conversation:', error);
        return res.status(500).json({ error: 'Failed to delete conversation' });
    }
});
router.patch('/history/:conversationId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { name, isPinned } = req.body;
        const conversation = await Conversation_1.ConversationModel.findOneAndUpdate({ _id: conversationId, userId }, {
            ...(name && { name }),
            ...(typeof isPinned === 'boolean' && { isPinned }),
            updatedAt: new Date()
        }, { new: true });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        return res.json(conversation);
    }
    catch (error) {
        console.error('❌ Error updating conversation:', error);
        return res.status(500).json({ error: 'Failed to update conversation' });
    }
});
router.get('/analytics', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { dateFrom, dateTo, agentId } = req.query;
        const matchQuery = { userId };
        if (dateFrom || dateTo) {
            matchQuery.createdAt = {};
            if (dateFrom) {
                matchQuery.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                matchQuery.createdAt.$lte = new Date(dateTo);
            }
        }
        if (agentId) {
            matchQuery.agentId = agentId;
        }
        const [conversationStats] = await Conversation_1.ConversationModel.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalConversations: { $sum: 1 },
                    activeConversations: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    pinnedConversations: {
                        $sum: { $cond: ['$metadata.isPinned', 1, 0] }
                    },
                    totalMessages: { $sum: '$metadata.messageCount' },
                    totalTokens: { $sum: '$metadata.totalTokens' },
                    averageResponseTime: { $avg: '$metadata.averageResponseTime' },
                    averageMessagesPerConversation: { $avg: '$metadata.messageCount' }
                }
            }
        ]);
        const conversationTrends = await Conversation_1.ConversationModel.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    messages: { $sum: '$metadata.messageCount' },
                    tokens: { $sum: '$metadata.totalTokens' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
            { $limit: 30 }
        ]);
        const agentStats = await Conversation_1.ConversationModel.aggregate([
            { $match: { ...matchQuery, agentId: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$agentId',
                    conversations: { $sum: 1 },
                    totalMessages: { $sum: '$metadata.messageCount' },
                    totalTokens: { $sum: '$metadata.totalTokens' },
                    averageResponseTime: { $avg: '$metadata.averageResponseTime' }
                }
            },
            { $sort: { conversations: -1 } },
            { $limit: 10 }
        ]);
        const modelStats = await Conversation_1.ConversationModel.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$modelId',
                    conversations: { $sum: 1 },
                    totalMessages: { $sum: '$metadata.messageCount' },
                    totalTokens: { $sum: '$metadata.totalTokens' }
                }
            },
            { $sort: { conversations: -1 } }
        ]);
        const response = {
            summary: conversationStats || {
                totalConversations: 0,
                activeConversations: 0,
                pinnedConversations: 0,
                totalMessages: 0,
                totalTokens: 0,
                averageResponseTime: 0,
                averageMessagesPerConversation: 0
            },
            trends: conversationTrends,
            agents: agentStats,
            models: modelStats,
            period: {
                from: dateFrom,
                to: dateTo
            }
        };
        return res.json(response);
    }
    catch (error) {
        console.error('❌ Error fetching conversation analytics:', error);
        return res.status(500).json({ error: 'Failed to fetch conversation analytics' });
    }
});
router.get('/search', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { query: searchQuery, limit = 20, offset = 0 } = req.query;
        if (!searchQuery) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        const userConversations = await Conversation_1.ConversationModel.find({ userId }).select('_id').lean();
        const conversationIds = userConversations.map(c => c._id.toString());
        const messages = await ConversationMessage_1.ConversationMessageModel.aggregate([
            {
                $match: {
                    conversationId: { $in: conversationIds },
                    $text: { $search: searchQuery }
                }
            },
            {
                $addFields: {
                    score: { $meta: 'textScore' }
                }
            },
            { $sort: { score: { $meta: 'textScore' }, createdAt: -1 } },
            { $skip: parseInt(offset) || 0 },
            { $limit: parseInt(limit) || 20 },
            {
                $lookup: {
                    from: 'conversations',
                    localField: 'conversationId',
                    foreignField: '_id',
                    as: 'conversation'
                }
            },
            {
                $project: {
                    id: '$_id',
                    conversationId: 1,
                    role: 1,
                    content: 1,
                    createdAt: 1,
                    score: 1,
                    conversationTitle: { $arrayElemAt: ['$conversation.title', 0] }
                }
            }
        ]);
        return res.json({
            messages,
            query: searchQuery,
            total: messages.length
        });
    }
    catch (error) {
        console.error('❌ Error searching conversations:', error);
        return res.status(500).json({ error: 'Failed to search conversations' });
    }
});
router.post('/export', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationIds, format = 'json' } = req.body;
        if (!conversationIds || !Array.isArray(conversationIds)) {
            return res.status(400).json({ error: 'Conversation IDs are required' });
        }
        const conversations = await Conversation_1.ConversationModel.find({
            _id: { $in: conversationIds },
            userId
        }).lean();
        if (conversations.length === 0) {
            return res.status(404).json({ error: 'No conversations found' });
        }
        const allMessages = await ConversationMessage_1.ConversationMessageModel.find({
            conversationId: { $in: conversations.map(c => c._id.toString()) }
        }).sort({ conversationId: 1, createdAt: 1 }).lean();
        const conversationsWithMessages = conversations.map(conv => {
            const messages = allMessages.filter((msg) => msg.conversationId === conv._id.toString());
            return {
                ...conv,
                id: conv._id,
                messages: messages.map((msg) => ({
                    id: msg._id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.createdAt,
                    metadata: msg.metadata
                }))
            };
        });
        let exportData;
        let contentType;
        let filename;
        switch (format) {
            case 'csv':
                const csvRows = [];
                csvRows.push(['Conversation ID', 'Conversation Title', 'Message Role', 'Message Content', 'Timestamp']);
                conversationsWithMessages.forEach((conv) => {
                    conv.messages.forEach((msg) => {
                        csvRows.push([
                            conv.id,
                            conv.title,
                            msg.role,
                            msg.content.replace(/"/g, '""'),
                            msg.timestamp
                        ]);
                    });
                });
                exportData = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                contentType = 'text/csv';
                filename = `conversations_${Date.now()}.csv`;
                break;
            case 'markdown':
                exportData = conversationsWithMessages.map((conv) => {
                    let md = `# ${conv.title}\n\n`;
                    md += `**Created:** ${new Date(conv.createdAt).toLocaleString()}\n`;
                    md += `**Last Updated:** ${new Date(conv.updatedAt).toLocaleString()}\n\n`;
                    conv.messages.forEach((msg) => {
                        md += `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n`;
                        md += `${msg.content}\n\n`;
                        md += `*${new Date(msg.timestamp).toLocaleString()}*\n\n---\n\n`;
                    });
                    return md;
                }).join('\n\n');
                contentType = 'text/markdown';
                filename = `conversations_${Date.now()}.md`;
                break;
            default:
                exportData = JSON.stringify(conversationsWithMessages, null, 2);
                contentType = 'application/json';
                filename = `conversations_${Date.now()}.json`;
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(exportData);
    }
    catch (error) {
        console.error('❌ Error exporting conversations:', error);
        return res.status(500).json({ error: 'Failed to export conversations' });
    }
});
router.post('/bulk', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { action, conversationIds } = req.body;
        if (!action || !conversationIds || !Array.isArray(conversationIds)) {
            return res.status(400).json({ error: 'Action and conversation IDs are required' });
        }
        let result;
        switch (action) {
            case 'delete':
                await Promise.all([
                    Conversation_1.ConversationModel.deleteMany({
                        _id: { $in: conversationIds },
                        userId
                    }),
                    ConversationMessage_1.ConversationMessageModel.deleteMany({
                        conversationId: { $in: conversationIds }
                    })
                ]);
                result = { deleted: conversationIds.length };
                break;
            case 'archive':
                await Conversation_1.ConversationModel.updateMany({ _id: { $in: conversationIds }, userId }, {
                    status: 'archived',
                    'metadata.isArchived': true,
                    updatedAt: new Date()
                });
                result = { archived: conversationIds.length };
                break;
            case 'pin':
                await Conversation_1.ConversationModel.updateMany({ _id: { $in: conversationIds }, userId }, {
                    'metadata.isPinned': true,
                    updatedAt: new Date()
                });
                result = { pinned: conversationIds.length };
                break;
            case 'unpin':
                await Conversation_1.ConversationModel.updateMany({ _id: { $in: conversationIds }, userId }, {
                    'metadata.isPinned': false,
                    updatedAt: new Date()
                });
                result = { unpinned: conversationIds.length };
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        return res.json({ success: true, ...result });
    }
    catch (error) {
        console.error('❌ Error performing bulk operation:', error);
        return res.status(500).json({ error: 'Failed to perform bulk operation' });
    }
});
exports.default = router;
//# sourceMappingURL=ConversationHttpRoutes.js.map