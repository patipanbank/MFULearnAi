import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { PromptController } from '../controllers/PromptController';
import { KnowledgeController } from '../controllers/KnowledgeController';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../auth/AuthService';
import { RateLimiter } from '../middleware/rateLimiter';
import { rateLimitByKey } from '../middleware/ApiKeyLimiter';
import { quotaEnforcer } from '../middleware/quotaEnforcer';
import { CompletionsController } from '../controllers/CompletionsController';
import apiKeyRoutes from './api-keys';

const router = Router();
const checkAuth = AuthService.authenticateUser;

// --- User Management (Moved from /auth to /api for Nginx alignment) ---
router.get('/users', checkAuth, AuthService.requireRole(['admin', 'superadmin']), AuthController.listUsers);
router.post('/users', checkAuth, AuthService.requireRole(['superadmin']), AuthController.createUser);
router.put('/users/:id', checkAuth, AuthService.requireRole(['superadmin']), AuthController.updateUser);
router.delete('/users/:id', checkAuth, AuthService.requireRole(['superadmin']), AuthController.deleteUser);
router.get('/users/me', checkAuth, AuthController.me); // Alias for /auth/me

// --- Departments ---
router.get('/departments', checkAuth, AuthController.listDepartments);
router.post('/departments', checkAuth, AuthService.requireRole(['superadmin']), AuthController.createDepartment);
router.put('/departments/:id', checkAuth, AuthService.requireRole(['superadmin']), AuthController.updateDepartment);
router.delete('/departments/:id', checkAuth, AuthService.requireRole(['superadmin']), AuthController.deleteDepartment);



// API Key Management Not restricted by RateLimiter but requires Auth
router.use('/keys', apiKeyRoutes);

// Chat Routes
router.post('/chat', checkAuth, RateLimiter.limit, rateLimitByKey, quotaEnforcer, ChatController.chat);
router.post('/chat/completions', checkAuth, RateLimiter.limit, rateLimitByKey, quotaEnforcer, CompletionsController.complete);
router.get('/chat/models', checkAuth, ChatController.getModels);
router.get('/chat/attachment/*', checkAuth, ChatController.downloadAttachment);
router.post('/chat/feedback', checkAuth, ChatController.submitFeedback);
router.get('/chat/:sessionId', checkAuth, ChatController.getHistory); // order matters
router.get('/chat', checkAuth, ChatController.listSessions);
router.delete('/chat/:sessionId', checkAuth, ChatController.clearSession);

// Prompt Routes
router.get('/prompts', checkAuth, PromptController.listPrompts);
router.post('/prompts', checkAuth, PromptController.createPrompt);
// Static paths must come before parameterized /:key routes
router.get('/prompts/meta/variables', checkAuth, PromptController.getVariables);
router.get('/prompts/:key', checkAuth, PromptController.getPrompt);
router.post('/prompts/:key/versions', checkAuth, PromptController.addVersion);
router.get('/prompts/:key/versions', checkAuth, PromptController.getVersionHistory);
router.post('/prompts/:key/toggle-active', checkAuth, PromptController.toggleActive);
router.post('/prompts/:key/preview', checkAuth, PromptController.previewPrompt);
router.post('/prompts/:key/rollback', checkAuth, PromptController.rollbackVersion);

import knowledgeRoutes from './knowledge';
router.use('/knowledge', checkAuth, rateLimitByKey, knowledgeRoutes);

import logRoutes from './logs';
router.use('/logs', checkAuth, logRoutes);

// Tool Access Management (superadmin only)
import toolRoutes from './tools';
router.use('/tools', checkAuth, AuthService.requireRole(['superadmin']), toolRoutes);



export default router;
