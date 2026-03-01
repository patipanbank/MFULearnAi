import { Router } from 'express';
import { EnhancedApiKeyController } from '../controllers/EnhancedApiKeyController';
import { AuthService } from '../auth/AuthService';

const router = Router();

const checkAuth = AuthService.authenticateUser;

// CRUD
router.get('/', checkAuth, EnhancedApiKeyController.listApiKeys);
router.post('/', checkAuth, EnhancedApiKeyController.createApiKey);
router.put('/:id', checkAuth, EnhancedApiKeyController.updateApiKey);
router.delete('/:id', checkAuth, EnhancedApiKeyController.revokeApiKey);

// Key Rotation
router.post('/:id/rotate', checkAuth, EnhancedApiKeyController.rotateApiKey);

// Usage & Analytics (per key)
router.get('/:id/usage', checkAuth, EnhancedApiKeyController.getKeyUsage);

// Available resources for key creation UI
router.get('/models', checkAuth, EnhancedApiKeyController.listModels);
router.get('/tools', checkAuth, EnhancedApiKeyController.listTools);
router.get('/knowledge', checkAuth, EnhancedApiKeyController.listKnowledge);
router.get('/departments', checkAuth, EnhancedApiKeyController.listDepartments);

export default router;
