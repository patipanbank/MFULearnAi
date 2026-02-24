/**
 * OpenAI-Compatible API Routes (/v1/*)
 *
 * Provides a fully OpenAI SDK-compatible API surface.
 * External consumers can use standard OpenAI client libraries.
 *
 * Usage with Python:
 *   client = OpenAI(api_key="sk_model_xxx", base_url="https://your-domain/v1")
 *
 * Usage with JavaScript:
 *   const client = new OpenAI({ apiKey: 'sk_model_xxx', baseURL: 'https://your-domain/v1' })
 */

import { Router } from 'express';
import { AuthService } from '../auth/AuthService';
import { OpenAIChatController } from '../openai/ChatCompletionsController';
import { OpenAIModelsController } from '../openai/ModelsController';
import { OpenAIEmbeddingsController } from '../openai/EmbeddingsController';
import { EnhancedApiKeyController } from '../controllers/EnhancedApiKeyController';
import { openaiApiKeyMiddleware } from '../middleware/OpenAIKeyMiddleware';

const router = Router();
const checkAuth = AuthService.authenticateUser;

// ═══════════════════════════════════════════════════════════════
// OpenAI-Compatible Endpoints (require API key auth)
// ═══════════════════════════════════════════════════════════════

// Chat Completions (sync + SSE streaming)
router.post('/chat/completions', checkAuth, ...openaiApiKeyMiddleware, OpenAIChatController.chatCompletions);

// Models
router.get('/models', checkAuth, OpenAIModelsController.listModels);
router.get('/models/:model', checkAuth, OpenAIModelsController.getModel);

// Embeddings
router.post('/embeddings', checkAuth, ...openaiApiKeyMiddleware, OpenAIEmbeddingsController.createEmbedding);

// ═══════════════════════════════════════════════════════════════
// API Key Management (require JWT auth)
// ═══════════════════════════════════════════════════════════════

// CRUD
router.get('/api-keys', checkAuth, EnhancedApiKeyController.listApiKeys);
router.post('/api-keys', checkAuth, EnhancedApiKeyController.createApiKey);
router.put('/api-keys/:id', checkAuth, EnhancedApiKeyController.updateApiKey);
router.delete('/api-keys/:id', checkAuth, EnhancedApiKeyController.revokeApiKey);

// Key Rotation
router.post('/api-keys/:id/rotate', checkAuth, EnhancedApiKeyController.rotateApiKey);

// Usage & Analytics (per key)
router.get('/api-keys/:id/usage', checkAuth, EnhancedApiKeyController.getKeyUsage);

// Available models for key creation
router.get('/api-keys/models', checkAuth, EnhancedApiKeyController.listModels);

// Organization usage (admin)
router.get('/usage/organization', checkAuth, AuthService.requireRole(['admin', 'superadmin']), EnhancedApiKeyController.getOrgUsage);

// Admin dashboard (superadmin)
router.get('/admin/usage/dashboard', checkAuth, AuthService.requireRole(['superadmin']), EnhancedApiKeyController.getAdminDashboard);

export default router;
