import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Initialize SAML strategy
authController.initializeSamlStrategy();

/**
 * SAML Authentication
 */
router.get('/login/saml', authController.samlLogin);
router.post('/saml/callback', ...authController.samlCallback);

// Initialize Google strategy
authController.initializeGoogleStrategy();

/**
 * Google Authentication
 */
router.get('/login/google', authController.googleLogin);
router.get('/google/callback', ...authController.googleCallback);

/**
 * Admin Authentication
 */
router.post('/admin/login', authController.adminLogin);

/**
 * Logout
 */
router.post('/logout', authController.logout);
router.get('/logout', authController.logoutRedirect);
router.get('/logout/saml', authController.samlLogout);

/**
 * SAML Metadata
 */
router.get('/metadata', authController.getMetadata);

export default router;
