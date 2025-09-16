import express from 'express';
import { chatService } from '../services/chatService';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler, notFoundError, validationError, forbiddenError } from '../utils/errorHandler';

const router = express.Router();

// Get all chats for the authenticated user
router.get('/', authenticateJWT, asyncHandler(async (req: any, res) => {
  const userId = req.user.sub || req.user.id;
  const chats = await chatService.getUserChats(userId);

  // Return array directly for frontend compatibility
  return res.json(chats);
}));

// Get chat history (special route)
router.get('/history', authenticateJWT, asyncHandler(async (req: any, res) => {
  const userId = req.user.sub || req.user.id;
  const chats = await chatService.getUserChats(userId);

  // Return array directly for frontend compatibility
  return res.json(chats);
}));

// Get specific chat history by session ID (must come before /:chatId route)
router.get('/history/:sessionId', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { sessionId } = req.params;
  const userId = req.user.sub || req.user.id;

  console.log(`📥 GET /history/${sessionId} for user: ${userId}`);

  // Validate sessionId format (should be 24 character hex string)
  if (!sessionId || sessionId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
    console.log(`❌ Invalid session ID format: ${sessionId}`);
    throw validationError('Invalid session ID format');
  }

  const chat = await chatService.getChat(sessionId, userId);

  if (!chat) {
    console.log(`❌ Chat not found or access denied: ${sessionId}`);
    throw notFoundError('Chat');
  }

  console.log(`✅ Returning chat: ${sessionId}`);
  // Return chat object directly for frontend compatibility
  return res.json(chat);
}));

// Get a specific chat by ID (must come after /history route)
router.get('/:chatId', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;

  // Validate chatId format (should be 24 character hex string)
  if (!chatId || chatId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(chatId)) {
    throw validationError('Invalid chat ID format');
  }

  const chat = await chatService.getChat(chatId, userId);

  if (!chat) {
    throw notFoundError('Chat');
  }

  // Return chat object directly for frontend compatibility
  return res.json(chat);
}));

// Create a new chat
router.post('/', authenticateJWT, asyncHandler(async (req: any, res) => {
  const userId = req.user.sub || req.user.id;
  const { name, agentId } = req.body;

  const chat = await chatService.createChat(userId, name || 'New Chat', agentId);

  // Return chat object directly for frontend compatibility
  return res.status(201).json(chat);
}));

// Update chat name (legacy endpoint)
router.post('/update-name', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chat_id, name } = req.body;
  const userId = req.user.sub || req.user.id;

  if (!chat_id || !name || typeof name !== 'string') {
    throw validationError('chat_id and name are required');
  }

  const chat = await chatService.updateChatName(chat_id, userId, name);

  if (!chat) {
    throw notFoundError('Chat');
  }

  return res.json(chat);
}));

// Update chat name (new endpoint)
router.put('/:chatId/name', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    throw validationError('Name is required');
  }

  const chat = await chatService.updateChatName(chatId, userId, name);

  if (!chat) {
    throw notFoundError('Chat');
  }

  return res.json(chat);
}));

// Pin/unpin a chat
router.post('/:chatId/pin', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;
  const { isPinned } = req.body;

  if (typeof isPinned !== 'boolean') {
    throw validationError('isPinned must be a boolean');
  }

  const chat = await chatService.updateChatPinStatus(chatId, userId, isPinned);

  if (!chat) {
    throw notFoundError('Chat');
  }

  return res.json(chat);
}));

// Clear chat memory
router.post('/:chatId/clear-memory', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;

  // Verify user has access to this chat
  const chat = await chatService.getChat(chatId, userId);
  if (!chat) {
    throw notFoundError('Chat');
  }

  await chatService.clearChatMemory(chatId);

  return res.json({
    success: true,
    message: 'Chat memory cleared successfully'
  });
}));

// Delete a chat
router.delete('/:chatId', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;

  const success = await chatService.deleteChat(chatId, userId);

  if (!success) {
    throw notFoundError('Chat');
  }

  return res.json({
    success: true,
    message: 'Chat deleted successfully'
  });
}));

// Get user's deleted chats (trash)
router.get('/trash', authenticateJWT, asyncHandler(async (req: any, res) => {
  const userId = req.user.sub || req.user.id;
  const deletedChats = await chatService.getUserDeletedChats(userId);

  return res.json(deletedChats);
}));

// Restore a deleted chat
router.post('/:chatId/restore', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;

  const restoredChat = await chatService.restoreChat(chatId, userId);

  if (!restoredChat) {
    throw notFoundError('Deleted chat');
  }

  return res.json({
    success: true,
    message: 'Chat restored successfully',
    chat: restoredChat
  });
}));

// Permanently delete a chat
router.delete('/:chatId/permanent', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId } = req.params;
  const userId = req.user.sub || req.user.id;

  const success = await chatService.permanentlyDeleteChat(chatId, userId);

  if (!success) {
    throw notFoundError('Chat');
  }

  return res.json({
    success: true,
    message: 'Chat permanently deleted'
  });
}));

// Delete a specific message
router.delete('/:chatId/messages/:messageId', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.sub || req.user.id;

  const success = await chatService.deleteMessage(chatId, messageId, userId);

  if (!success) {
    throw notFoundError('Message');
  }

  return res.json({
    success: true,
    message: 'Message deleted successfully'
  });
}));

// Restore a deleted message
router.post('/:chatId/messages/:messageId/restore', authenticateJWT, asyncHandler(async (req: any, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.sub || req.user.id;

  const success = await chatService.restoreMessage(chatId, messageId, userId);

  if (!success) {
    throw notFoundError('Deleted message');
  }

  return res.json({
    success: true,
    message: 'Message restored successfully'
  });
}));

// Get memory statistics (admin only)
router.get('/memory/stats', authenticateJWT, asyncHandler(async (req: any, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw forbiddenError();
  }

  const stats = chatService.getStats();

  return res.json({
    success: true,
    data: stats
  });
}));

// Get chat statistics (admin only)
router.get('/stats/overview', authenticateJWT, asyncHandler(async (req: any, res) => {
  // Check if user is admin (you can implement role-based access control here)
  if (req.user.role !== 'admin') {
    throw forbiddenError();
  }

  const stats = chatService.getStats();

  return res.json({
    success: true,
    data: stats
  });
}));

// Get agent cache statistics (admin only)
router.get('/stats/agent-cache', authenticateJWT, asyncHandler(async (req: any, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw forbiddenError();
  }

  const cacheStats = chatService.getAgentCacheStats();

  return res.json({
    success: true,
    data: cacheStats
  });
}));

// Clear agent cache (admin only)
router.post('/stats/agent-cache/clear', authenticateJWT, asyncHandler(async (req: any, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw forbiddenError();
  }

  chatService.clearAgentCache();

  return res.json({
    success: true,
    message: 'Agent cache cleared successfully'
  });
}));

export default router; 