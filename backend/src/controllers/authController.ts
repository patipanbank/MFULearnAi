import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { authService } from '../services/authService';
import config from '../config/config';

class AuthController {
  /**
   * SAML Login - เริ่มต้น SAML authentication flow
   */
  samlLogin = passport.authenticate('saml', {
    failureRedirect: '/login',
    failureFlash: true
  });

  /**
   * SAML Callback Handler - รับ SAML response และสร้าง JWT
   */
  samlCallback = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('saml', async (err: any, profile: any, info: any) => {
      // Handle authentication errors
      if (err || !profile) {
        console.log('❌ SAML Authentication failed:', err);
        return res.redirect(
          `${config.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`
        );
      }

      try {
        // Process SAML login through service layer
        const { token, user } = await authService.handleSamlLogin(profile);

        // Redirect to frontend with token
        const redirectUrl = `${config.FRONTEND_URL}/auth/callback?token=${token}`;
        console.log(`🔄 Redirecting to: ${redirectUrl}`);
        return res.redirect(redirectUrl);

      } catch (error: any) {
        console.log(`❌ Error processing SAML login: ${error.message}`);
        return res.redirect(
          `${config.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(error.message)}`
        );
      }
    })(req, res, next);
  };

  /**
   * SAML Metadata endpoint
   */
  samlMetadata = (req: Request, res: Response) => {
    const passportSaml = require('passport-saml');
    const samlServiceModule = require('../services/samlService');

    const SamlStrategy = passportSaml.Strategy;
    const getSamlConfig = samlServiceModule.getSamlConfig;

    const samlStrategy = new SamlStrategy(getSamlConfig(), (() => {}) as any);
    res.type('application/xml');

    const cert = config.SAML_CERTIFICATE
      ? config.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim()
      : undefined;

    if (cert) {
      res.send(samlStrategy.generateServiceProviderMetadata(cert));
    } else {
      res.send(samlStrategy.generateServiceProviderMetadata(null));
    }
  };

  /**
   * SAML Logout
   */
  samlLogout = (req: Request, res: Response) => {
    const { name_id, session_index } = req.query;
    console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
    return res.redirect(`${config.FRONTEND_URL}/login?logged_out=true`);
  };

  /**
   * SAML Logout Manual Return
   */
  samlLogoutManual = (req: Request, res: Response) => {
    console.log('Manual return from SAML logout');
    return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true&manual=true`);
  };

  /**
   * SAML Logout Callback (POST)
   */
  samlLogoutCallbackPost = (req: Request, res: Response) => {
    console.log('SAML logout callback received (POST)');
    return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true`);
  };

  /**
   * SAML Logout Callback (GET)
   */
  samlLogoutCallbackGet = (req: Request, res: Response) => {
    console.log('SAML logout callback received (GET)');
    const { SAMLResponse, SAMLRequest, RelayState } = req.query;

    console.log(`GET request - SAMLResponse: ${SAMLResponse ? 'present' : 'not present'}`);
    console.log(`GET request - SAMLRequest: ${SAMLRequest ? 'present' : 'not present'}`);
    console.log(`GET request - RelayState: ${RelayState}`);

    if (!SAMLResponse && !SAMLRequest) {
      console.log('No SAML data in GET request, redirecting to login');
    }

    return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true`);
  };

  /**
   * Admin Login - ใช้ username/password
   */
  adminLogin = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ detail: 'Username and password are required' });
      }

      const { token, user } = await authService.handleAdminLogin(username, password);

      return res.json({
        token,
        user: user.toObject()
      });

    } catch (error: any) {
      console.log(`❌ Admin login failed: ${error.message}`);
      return res.status(401).json({ detail: error.message });
    }
  };

  /**
   * Get Current User Info - ใช้ JWT token
   */
  getCurrentUser = (req: Request, res: Response) => {
    const user = (req as any).user;
    const userResponse = authService.formatUserResponse(user);
    return res.json(userResponse);
  };

  /**
   * Refresh Token
   */
  refreshToken = (req: Request, res: Response) => {
    const user = (req as any).user;
    const newToken = authService.refreshToken(user);
    return res.json({ token: newToken });
  };

  /**
   * Simple Logout
   */
  logout = (req: Request, res: Response) => {
    return res.redirect(`${config.FRONTEND_URL}/login?logged_out=true`);
  };
}

export const authController = new AuthController();
