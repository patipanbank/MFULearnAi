/**
 * ConversationHttpRoutes - HTTP API endpoints for conversation management
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { ConversationMessageModel } from '../models/ConversationMessage';

const router = Router();

// Get conversation history with advanced filtering and search
router.get('/history', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      page = 1,
      limit = 50,
      search,
      status,
      dateFrom,
      dateTo,
      agentId,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      pinned
    } = req.query;

    // Build query
    const query: any = { userId };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Agent filter
    if (agentId) {
      query.agentId = agentId;
    }

    // Pinned filter
    if (pinned !== undefined) {
      query['metadata.isPinned'] = pinned === 'true';
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.updatedAt = {};
      if (dateFrom) {
        query.updatedAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.updatedAt.$lte = new Date(dateTo as string);
      }
    }

    // Text search
    if (search) {
      query.$text = { $search: search as string };
    }

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with aggregation for richer data
    const [conversations, totalCount] = await Promise.all([
      ConversationModel.aggregate([
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
      ConversationModel.countDocuments(query)
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
  } catch (error) {
    console.error('❌ Error fetching conversation history:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Get specific conversation by ID
router.get('/history/:conversationId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      userId
    }).lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages for this conversation
    const messages = await ConversationMessageModel.find({
      conversationId
    }).sort({ timestamp: 1 }).lean();

    // Format response to match frontend expectations
    const response = {
      ...conversation,
      id: conversation._id,
      messages: messages.map((msg: any) => ({
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
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Delete conversation
router.delete('/history/:conversationId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    // Verify ownership
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      userId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete conversation and its messages
    await Promise.all([
      ConversationModel.deleteOne({ _id: conversationId }),
      ConversationMessageModel.deleteMany({ conversationId })
    ]);

    return res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Update conversation (e.g., rename)
router.patch('/history/:conversationId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;
    const { name, isPinned } = req.body;

    const conversation = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, userId },
      {
        ...(name && { name }),
        ...(typeof isPinned === 'boolean' && { isPinned }),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json(conversation);
  } catch (error) {
    console.error('❌ Error updating conversation:', error);
    return res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Get conversation analytics and statistics
router.get('/analytics', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { dateFrom, dateTo, agentId } = req.query;

    // Build match query
    const matchQuery: any = { userId };

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) {
        matchQuery.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        matchQuery.createdAt.$lte = new Date(dateTo as string);
      }
    }

    if (agentId) {
      matchQuery.agentId = agentId;
    }

    // Aggregate conversation statistics
    const [conversationStats] = await ConversationModel.aggregate([
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

    // Get conversation trends by date
    const conversationTrends = await ConversationModel.aggregate([
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

    // Get agent usage statistics
    const agentStats = await ConversationModel.aggregate([
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

    // Get model usage statistics
    const modelStats = await ConversationModel.aggregate([
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
  } catch (error) {
    console.error('❌ Error fetching conversation analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation analytics' });
  }
});

// Search conversation messages
router.get('/search', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { query: searchQuery, limit = 20, offset = 0 } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // First get user's conversations
    const userConversations = await ConversationModel.find({ userId }).select('_id').lean();
    const conversationIds = userConversations.map(c => c._id.toString());

    // Search messages in user's conversations
    const messages = await ConversationMessageModel.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          $text: { $search: searchQuery as string }
        }
      },
      {
        $addFields: {
          score: { $meta: 'textScore' }
        }
      },
      { $sort: { score: { $meta: 'textScore' }, createdAt: -1 } },
      { $skip: parseInt(offset as string) || 0 },
      { $limit: parseInt(limit as string) || 20 },
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
  } catch (error) {
    console.error('❌ Error searching conversations:', error);
    return res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// Export conversation
router.post('/export', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { conversationIds, format = 'json' } = req.body;

    if (!conversationIds || !Array.isArray(conversationIds)) {
      return res.status(400).json({ error: 'Conversation IDs are required' });
    }

    // Get conversations and verify ownership
    const conversations = await ConversationModel.find({
      _id: { $in: conversationIds },
      userId
    }).lean();

    if (conversations.length === 0) {
      return res.status(404).json({ error: 'No conversations found' });
    }

    // Get messages for all conversations
    const allMessages = await ConversationMessageModel.find({
      conversationId: { $in: conversations.map(c => c._id.toString()) }
    }).sort({ conversationId: 1, createdAt: 1 }).lean();

    // Group messages by conversation
    const conversationsWithMessages = conversations.map(conv => {
      const messages = allMessages.filter((msg: any) =>
        msg.conversationId === conv._id.toString()
      );

      return {
        ...conv,
        id: conv._id,
        messages: messages.map((msg: any) => ({
          id: msg._id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
          metadata: msg.metadata
        }))
      };
    });

    // Format response based on requested format
    let exportData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        // Flatten to CSV format
        const csvRows = [];
        csvRows.push(['Conversation ID', 'Conversation Title', 'Message Role', 'Message Content', 'Timestamp']);

        conversationsWithMessages.forEach((conv: any) => {
          conv.messages.forEach((msg: any) => {
            csvRows.push([
              conv.id,
              conv.title,
              msg.role,
              msg.content.replace(/"/g, '""'), // Escape quotes
              msg.timestamp
            ]);
          });
        });

        exportData = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        contentType = 'text/csv';
        filename = `conversations_${Date.now()}.csv`;
        break;

      case 'markdown':
        exportData = conversationsWithMessages.map((conv: any) => {
          let md = `# ${conv.title}\n\n`;
          md += `**Created:** ${new Date(conv.createdAt).toLocaleString()}\n`;
          md += `**Last Updated:** ${new Date(conv.updatedAt).toLocaleString()}\n\n`;

          conv.messages.forEach((msg: any) => {
            md += `## ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n\n`;
            md += `${msg.content}\n\n`;
            md += `*${new Date(msg.timestamp).toLocaleString()}*\n\n---\n\n`;
          });

          return md;
        }).join('\n\n');
        contentType = 'text/markdown';
        filename = `conversations_${Date.now()}.md`;
        break;

      default: // json
        exportData = JSON.stringify(conversationsWithMessages, null, 2);
        contentType = 'application/json';
        filename = `conversations_${Date.now()}.json`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(exportData);

  } catch (error) {
    console.error('❌ Error exporting conversations:', error);
    return res.status(500).json({ error: 'Failed to export conversations' });
  }
});

// Bulk operations on conversations
router.post('/bulk', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { action, conversationIds } = req.body;

    if (!action || !conversationIds || !Array.isArray(conversationIds)) {
      return res.status(400).json({ error: 'Action and conversation IDs are required' });
    }

    let result;

    switch (action) {
      case 'delete':
        // Delete conversations and their messages
        await Promise.all([
          ConversationModel.deleteMany({
            _id: { $in: conversationIds },
            userId
          }),
          ConversationMessageModel.deleteMany({
            conversationId: { $in: conversationIds }
          })
        ]);
        result = { deleted: conversationIds.length };
        break;

      case 'archive':
        await ConversationModel.updateMany(
          { _id: { $in: conversationIds }, userId },
          {
            status: 'archived',
            'metadata.isArchived': true,
            updatedAt: new Date()
          }
        );
        result = { archived: conversationIds.length };
        break;

      case 'pin':
        await ConversationModel.updateMany(
          { _id: { $in: conversationIds }, userId },
          {
            'metadata.isPinned': true,
            updatedAt: new Date()
          }
        );
        result = { pinned: conversationIds.length };
        break;

      case 'unpin':
        await ConversationModel.updateMany(
          { _id: { $in: conversationIds }, userId },
          {
            'metadata.isPinned': false,
            updatedAt: new Date()
          }
        );
        result = { unpinned: conversationIds.length };
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.json({ success: true, ...result });

  } catch (error) {
    console.error('❌ Error performing bulk operation:', error);
    return res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

export default router;