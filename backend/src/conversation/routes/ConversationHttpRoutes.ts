/**
 * ConversationHttpRoutes - HTTP API endpoints for conversation management
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { ConversationMessageModel } from '../models/ConversationMessage';

const router = Router();

// Get conversation history
router.get('/history', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const conversations = await ConversationModel.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.json(conversations);
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

export default router;