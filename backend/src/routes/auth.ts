
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../auth/AuthService';

const router = Router();

// Public / Login
router.post('/admin/login', AuthController.loginAdmin);
router.get('/login/saml', AuthController.startSamlLogin);
router.post('/saml/callback', AuthController.handleSamlCallback);
router.get('/login/sso', AuthController.startSsoLogin);
router.post('/sso/callback', AuthController.handleSsoCallback);
router.post('/refresh', AuthController.refresh);

// Protected
router.get('/me', AuthService.authenticateUser, AuthController.me);

// Note: User and Department management routes moved to /api/users and /api/departments in index.ts

export default router;
