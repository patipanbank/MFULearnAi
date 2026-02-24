import { Router } from 'express';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { AuthService } from '../auth/AuthService';

const router = Router();

// Middleware to ensure user is logged in
const checkAuth = AuthService.authenticateUser;

// List all keys
router.get('/', checkAuth, ApiKeyController.listApiKeys);

// Available models (for key creation UI)
router.get('/models', checkAuth, ApiKeyController.listModels);

// Create a new key
router.post('/', checkAuth, ApiKeyController.createApiKey);

// Revoke a key
router.delete('/:id', checkAuth, ApiKeyController.revokeApiKey);

export default router;
