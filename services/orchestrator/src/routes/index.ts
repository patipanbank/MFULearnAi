import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { PromptController } from '../controllers/PromptController';
import { KnowledgeController } from '../controllers/KnowledgeController';
import { authenticateToken } from '../../../../shared/middleware/auth';
import { RateLimiter } from '../middleware/rateLimiter';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const checkAuth = authenticateToken(JWT_SECRET);

// Chat Routes
router.post('/chat', checkAuth, RateLimiter.limit, ChatController.chat);
router.get('/chat/models', checkAuth, ChatController.getModels);
router.get('/chat/:sessionId', checkAuth, ChatController.getHistory); // order matters, :sessionId vs models usually handled by express correctly if fixed path is first
router.get('/chat', checkAuth, ChatController.listSessions);
router.delete('/chat/:sessionId', checkAuth, ChatController.clearSession);

// Prompt Routes
router.get('/prompts', checkAuth, PromptController.listPrompts);
router.post('/prompts', checkAuth, PromptController.createPrompt);
router.get('/prompts/:key', checkAuth, PromptController.getPrompt);
router.post('/prompts/:key/versions', checkAuth, PromptController.addVersion);
router.post('/prompts/:key/toggle-active', checkAuth, PromptController.toggleActive);

// Knowledge Routes (Proxy)
router.get('/knowledge/:id/view', checkAuth, KnowledgeController.view);

export default router;
