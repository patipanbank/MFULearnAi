import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { PromptController } from '../controllers/PromptController';
import { KnowledgeController } from '../controllers/KnowledgeController';
import { authenticateToken } from '../../../shared/middleware/auth';
import { RateLimiter } from '../middleware/rateLimiter';

const router = Router();
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const JWT_SECRET = process.env.JWT_SECRET || (ENV_TYPE === 'PROD' ? '' : 'dev-secret');

if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is required in PROD environment');
    process.exit(1);
}

const checkAuth = authenticateToken(JWT_SECRET);

// Chat Routes
router.post('/chat', checkAuth, RateLimiter.limit, ChatController.chat);
router.get('/chat/models', checkAuth, ChatController.getModels);
router.get('/chat/attachment/*', checkAuth, ChatController.downloadAttachment);
router.get('/chat/:sessionId', checkAuth, ChatController.getHistory); // order matters, :sessionId vs models usually handled by express correctly if fixed path is first
router.get('/chat', checkAuth, ChatController.listSessions);
router.delete('/chat/:sessionId', checkAuth, ChatController.clearSession);

// Prompt Routes
router.get('/prompts', checkAuth, PromptController.listPrompts);
router.post('/prompts', checkAuth, PromptController.createPrompt);
router.get('/prompts/:key', checkAuth, PromptController.getPrompt);
router.post('/prompts/:key/versions', checkAuth, PromptController.addVersion);
router.post('/prompts/:key/toggle-active', checkAuth, PromptController.toggleActive);

import knowledgeRoutes from './knowledge';
router.use('/knowledge', checkAuth, knowledgeRoutes);

import logRoutes from './logs';
router.use('/logs', checkAuth, logRoutes);

import authRoutes from './auth';
router.use('/auth', authRoutes);

export default router;
