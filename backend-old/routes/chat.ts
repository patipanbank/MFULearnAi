import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import * as chatController from '../controllers/chat.controller';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Standard roles that can access chat features
const chatRoles: UserRole[] = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];

/**
 * Chat endpoints
 */

// SSE streaming chat
router.post('/', chatController.streamChat);

// Chat history management
router.post('/history', authorize(chatRoles), chatController.saveHistory);
router.get('/chats', authorize(chatRoles), chatController.getChats);
router.get('/chats/:chatId', authorize(chatRoles), chatController.getChat);
router.put('/history/:chatId', authorize(chatRoles), chatController.updateChat);
router.delete('/history/:chatId', authorize(chatRoles), chatController.deleteChat);

// Chat rename and pin
router.put(
  '/history/:chatId/rename',
  authorize(chatRoles),
  chatController.validateRenameChat,
  chatController.renameChat
);
router.put('/history/:chatId/pin', authorize(chatRoles), chatController.togglePinChat);

// Export/Import
router.get('/history/:chatId/export', authorize(chatRoles), chatController.exportChat);
router.post('/history/import', authorize(chatRoles), chatController.importChat);

// Clear all history
router.delete('/clear', chatController.clearHistory);

// Add message to existing chat
router.post('/history/:chatId/messages', authorize(chatRoles), chatController.addMessage);

// Edit message
router.post('/edit-message', authorize(chatRoles), chatController.editMessage);

// Usage information
router.get('/usage', chatController.getUsage);

// File parsing
router.post(
  '/parse-file',
  authorize(chatRoles),
  chatController.uploadMiddleware.single('file'),
  chatController.parseFile
);

// Collections
router.get('/collections', chatController.getCollections);

export default router;
