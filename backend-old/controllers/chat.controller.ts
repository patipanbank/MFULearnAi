import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { AuthenticatedRequest } from '../types/common';
import { chatService } from '../services/chat';
import { usageService } from '../services/usage.service';
import { fileParserService } from '../services/fileParser';
import { CollectionModel, CollectionPermission } from '../models/Collection';
import { Chat } from '../models/Chat';
import { 
  BadRequestError, 
  NotFoundError, 
  UnauthorizedError 
} from '../errors';
import { asyncHandler } from '../middleware/errorHandler';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

// Multer configuration
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/**
 * Get user from request or throw error
 */
const getUserId = (req: AuthenticatedRequest): string => {
  const userId = req.user?.username;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  return userId;
};

/**
 * Validate MongoDB ObjectId format
 */
const validateObjectId = (id: string): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError('Invalid ID format');
  }
};

/**
 * POST /api/chat - SSE chat endpoint
 */
export const streamChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> => {
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

  const sendChunk = (content: string): void => {
    const data = JSON.stringify({ content });
    res.write(`data: ${data}\n\n`);
  };

  // Start stream
  sendChunk('');

  try {
    for await (const content of chatService.generateResponse(
      messages,
      query,
      modelId,
      collectionName
    )) {
      sendChunk(content);
    }
  } catch (error) {
    console.error('Error in stream generation:', error);
    sendChunk('\nSorry, an error occurred. Please try again.');
  }

  res.end();
});

/**
 * POST /api/chat/history - Save chat history
 */
export const saveHistory = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { messages, modelId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new BadRequestError('Invalid messages format');
  }

  if (!modelId) {
    throw new BadRequestError('ModelId is required');
  }

  const chat = await chatService.saveChat(userId, modelId, messages);
  res.json(chat);
});

/**
 * GET /api/chat/chats - Get user's chats
 */
export const getChats = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const chats = await chatService.getChats(userId, page, limit);
  res.json(chats);
});

/**
 * GET /api/chat/chats/:chatId - Get specific chat
 */
export const getChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  
  validateObjectId(chatId);

  const chat = await chatService.getChat(userId, chatId);
  res.json(chat);
});

/**
 * PUT /api/chat/history/:chatId - Update chat
 */
export const updateChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { chatId } = req.params;
  const { messages } = req.body;

  validateObjectId(chatId);

  const updatedChat = await chatService.updateChat(chatId, userId, messages);
  res.json(updatedChat);
});

/**
 * DELETE /api/chat/history/:chatId - Delete chat
 */
export const deleteChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { chatId } = req.params;

  validateObjectId(chatId);

  await chatService.deleteChat(chatId, userId);
  res.json({ success: true, message: 'Chat deleted successfully' });
});

/**
 * GET /api/chat/history/:chatId/export - Export chat
 */
export const exportChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { chatId } = req.params;

  validateObjectId(chatId);

  const chat = await chatService.getChat(userId, chatId);
  res.json(chat);
});

/**
 * POST /api/chat/history/import - Import chat
 */
export const importChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { messages } = req.body;

  const importedChat = await chatService.saveChat(userId, 'default', messages);
  res.json(importedChat);
});

/**
 * DELETE /api/chat/clear - Clear all chat history
 */
export const clearHistory = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  
  await Chat.deleteMany({ userId });
  res.json({ success: true, message: 'Chat history cleared successfully' });
});

/**
 * Validation for rename chat
 */
export const validateRenameChat = [
  body('newName')
    .trim()
    .notEmpty().withMessage('Chat name cannot be empty')
    .isLength({ max: 100 }).withMessage('Chat name too long (max 100 characters)')
    .matches(/^[^<>]*$/).withMessage('Chat name contains invalid characters'),
];

/**
 * PUT /api/chat/history/:chatId/rename - Rename chat
 */
export const renameChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new BadRequestError('Validation failed', errors.array());
  }

  const userId = getUserId(req);
  const { chatId } = req.params;
  const { newName } = req.body;

  validateObjectId(chatId);

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new NotFoundError('Chat not found or unauthorized');
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
export const togglePinChat = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const { chatId } = req.params;

  validateObjectId(chatId);

  // Verify chat exists
  await chatService.getChat(userId, chatId);
  
  const updatedChat = await chatService.togglePinChat(chatId, userId);
  res.json(updatedChat);
});

/**
 * GET /api/chat/usage - Get user usage info
 */
export const getUsage = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = getUserId(req);
  const usage = await usageService.getUserUsage(userId);
  res.json(usage);
});

/**
 * POST /api/chat/parse-file - Parse uploaded file
 */
export const parseFile = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.file) {
    throw new BadRequestError('No file uploaded');
  }

  const text = await fileParserService.parseFile(req.file);
  res.json({ text });
});

/**
 * POST /api/chat/edit-message - Edit message in chat
 */
export const editMessage = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { chatId, messageId, content, role, isEdited } = req.body;
  const userId = getUserId(req);

  if (!chatId) {
    throw new BadRequestError('Invalid chat ID');
  }
  validateObjectId(chatId);

  if (!messageId) {
    throw new BadRequestError('Message ID is required');
  }

  if (!content) {
    throw new BadRequestError('Content is required');
  }

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new NotFoundError('Chat not found or unauthorized');
  }

  const messageIdStr = String(messageId);
  const messageIndex = chat.messages.findIndex(m => String(m.id) === messageIdStr);

  if (messageIndex === -1) {
    throw new NotFoundError('Message not found');
  }

  chat.messages[messageIndex].content = content;

  if (role === 'assistant' && isEdited) {
    try {
      chat.messages[messageIndex].set('isEdited', true);
    } catch {
      // Ignore if field doesn't exist in schema
    }
  }

  await chat.save();
  res.json({ success: true });
});

/**
 * POST /api/chat/history/:chatId/messages - Add message to chat
 */
export const addMessage = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { chatId } = req.params;
  const { message } = req.body;
  const userId = getUserId(req);

  validateObjectId(chatId);

  if (!message || !message.content || !message.role) {
    throw new BadRequestError('Message content and role are required');
  }

  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new NotFoundError('Chat not found or unauthorized');
  }

  const newMessage: any = {
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
export const getCollections = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = req.user;
  const collections = await CollectionModel.find({});

  // Admin can access all collections
  if (user.groups.includes('Admin') || user.groups.includes('SuperAdmin')) {
    res.json(collections.map(c => c.name));
    return;
  }

  // Filter by permission
  const accessibleCollections = collections.filter(collection => {
    switch (collection.permission) {
      case CollectionPermission.PUBLIC:
        return true;
      case CollectionPermission.PRIVATE:
        return collection.createdBy === user.nameID;
      default:
        return false;
    }
  });

  res.json(accessibleCollections.map(c => c.name));
});
