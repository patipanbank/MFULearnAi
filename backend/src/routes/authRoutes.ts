import { Router } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { getSamlConfig } from '../services/samlService';
import { authController } from '../controllers/authController';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';

const router = Router();

// Initialize SAML Strategy
passport.use('saml', new SamlStrategy(
  getSamlConfig(),
  (profile: any, done: (err: any, user?: any) => void) => {
    return done(null, profile || undefined);
  }
));

// ==================== SAML Routes ====================

// SAML Login - เริ่มต้น SAML authentication
router.get('/login/saml', authController.samlLogin);

// SAML Callback - รับ SAML response (รองรับทั้ง POST และ GET)
router.post('/saml/callback', authController.samlCallback);
router.get('/saml/callback', authController.samlCallback);

// SAML Metadata
router.get('/metadata', authController.samlMetadata);

// SAML Logout endpoints
router.get('/logout/saml', authController.samlLogout);
router.get('/logout/saml/manual', authController.samlLogoutManual);
router.post('/logout/saml/callback', authController.samlLogoutCallbackPost);
router.get('/logout/saml/callback', authController.samlLogoutCallbackGet);

// ==================== Admin Routes ====================

// Admin Login - ใช้ username/password
router.post('/admin/login', authController.adminLogin);

// ==================== User Routes ====================

// Get Current User Info - ต้อง authenticate ด้วย JWT
router.get('/me', authenticateJWT, requireAnyRole, authController.getCurrentUser);

// Refresh Token - ต้อง authenticate ด้วย JWT
router.post('/refresh', authenticateJWT, requireAnyRole, authController.refreshToken);

// Simple Logout
router.get('/logout', authController.logout);

export default router;
