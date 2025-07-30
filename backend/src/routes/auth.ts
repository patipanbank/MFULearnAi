import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { getSamlConfig } from '../services/samlService';
import { userService } from '../services/userService';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import config from '../config/config';

const router = Router();

interface SamlProfile {
  nameID: string;
  nameIDFormat: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  groups: string[];
}

// SAML Strategy
passport.use('saml', new (SamlStrategy as any)(getSamlConfig(), (profile: any, done: any) => {
  return done(null, profile || undefined);
}, (profile: any, done: any) => {
  return done(null, profile || undefined);
}, (profile: any, done: any) => {
  return done(null, profile || undefined);
}, (profile: any, done: any) => {
  return done(null, profile || undefined);
}, (profile: any, done: any) => {
  return done(null, profile || undefined);
}));

// SAML Login
router.get('/login/saml', passport.authenticate('saml', { failureRedirect: '/login', failureFlash: true }));

// SAML Callback (mapping, JWT, redirect, error handling)
router.post('/saml/callback', (req: Request, res: Response, next: NextFunction) => {
  (passport.authenticate as any)('saml', { failureRedirect: '/login', failureFlash: true }, async (err: any, profile: any, info: any) => {
    if (err) {
      console.error('❌ SAML authentication error:', err);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    if (!profile) {
      console.error('❌ No SAML profile received');
      return res.status(401).json({
        success: false,
        error: 'No profile received from SAML provider'
      });
    }

    try {
      // แปลง SAML profile เป็น user profile
      const userProfile = {
        nameID: profile.nameID,
        username: profile.username || profile.nameID,
        email: profile.email,
        firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
        lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
        department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organizationalunit'] || '',
        groups: profile.groups || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || []
      };

      console.log('📋 SAML Profile:', userProfile);

      // ใช้ userService จริง
      const user = await userService.find_or_create_saml_user(userProfile);
      console.log(`👤 Created/Found User: ${user.username} (${user.email})`);

      // สร้าง JWT token
      const token = jwt.sign({
        id: (user as any)._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department
      }, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);

    } catch (error) {
      console.error('❌ Error processing SAML callback:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process authentication'
      });
    }
  })(req, res, next);
});

// SAML Callback GET route (for compatibility)
router.get('/saml/callback', (req: Request, res: Response, next: NextFunction) => {
  (passport.authenticate as any)('saml', { failureRedirect: '/login', failureFlash: true }, async (err: any, profile: any, info: any) => {
    if (err) {
      console.error('❌ SAML authentication error:', err);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    if (!profile) {
      console.error('❌ No SAML profile received');
      return res.status(401).json({
        success: false,
        error: 'No profile received from SAML provider'
      });
    }

    try {
      // แปลง SAML profile เป็น user profile
      const userProfile = {
        nameID: profile.nameID,
        username: profile.username || profile.nameID,
        email: profile.email,
        firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '',
        lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '',
        department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organizationalunit'] || '',
        groups: profile.groups || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || []
      };

      console.log('📋 SAML Profile:', userProfile);

      // ใช้ userService จริง
      const user = await userService.find_or_create_saml_user(userProfile);
      console.log(`👤 Created/Found User: ${user.username} (${user.email})`);

      // สร้าง JWT token
      const token = jwt.sign({
        id: (user as any)._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department
      }, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);

    } catch (error) {
      console.error('❌ Error processing SAML callback:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process authentication'
      });
    }
  })(req, res, next);
});

// SAML Metadata
router.get('/metadata', (req: Request, res: Response) => {
  const samlStrategy = new SamlStrategy(getSamlConfig(), (() => {}) as any, (() => {}) as any);
  res.type('application/xml');
  const cert = process.env.SAML_CERTIFICATE ? process.env.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim() : undefined;
  if (cert) {
    res.send(samlStrategy.generateServiceProviderMetadata(cert));
  } else {
    res.send(samlStrategy.generateServiceProviderMetadata(null));
  }
});

// SAML Logout (redirect/logout SAML)
router.get('/logout/saml', (req: Request, res: Response) => {
  const { name_id, session_index } = req.query;
  console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
  
  // For now, redirect to simple logout
  // TODO: Implement proper SAML SLO when needed
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?logged_out=true`);
});

// SAML Logout Manual Return
router.get('/logout/saml/manual', (req: Request, res: Response) => {
  console.log('Manual return from SAML logout');
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true&manual=true`);
});

// SAML Logout Callback
router.post('/logout/saml/callback', (req: Request, res: Response) => {
  console.log('SAML logout callback received (POST)');
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
});

router.get('/logout/saml/callback', (req: Request, res: Response) => {
  console.log('SAML logout callback received (GET)');
  const { SAMLResponse, SAMLRequest, RelayState } = req.query;
  
  console.log(`GET request - SAMLResponse: ${SAMLResponse ? 'present' : 'not present'}`);
  console.log(`GET request - SAMLRequest: ${SAMLRequest ? 'present' : 'not present'}`);
  console.log(`GET request - RelayState: ${RelayState}`);
  
  // If no SAML data, just redirect to login
  if (!SAMLResponse && !SAMLRequest) {
    console.log('No SAML data in GET request, redirecting to login');
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
  }
  
  // For now, assume logout succeeded
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?saml_logged_out=true`);
});

// Admin login route
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const user = await userService.find_admin_by_username(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isMatch = await userService.verify_admin_password(password, user.password || '');
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create JWT token
    const tokenPayload = {
      sub: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };
    const token = jwt.sign(tokenPayload, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get Current User Info (JWT) - เหมือน FastAPI /me
router.get('/me', authenticateJWT, requireAnyRole, (req: Request, res: Response) => {
  // user ถูก decode จาก JWT แล้วใน middleware
  const user = (req as any).user;
  return res.json(user);
});

// Refresh Token (JWT) - เหมือน FastAPI /refresh
router.post('/refresh', authenticateJWT, requireAnyRole, (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // สร้าง token ใหม่ (7 วัน) เหมือน Python
  const newTokenPayload = {
    sub: user.sub,
    nameID: user.nameID,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    department: user.department,
    groups: user.groups,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
  };
  
  const newToken = jwt.sign(newTokenPayload, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });
  
  return res.json({ token: newToken });
});

// Simple Logout - เหมือน FastAPI /logout
router.get('/logout', (req: Request, res: Response) => {
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?logged_out=true`);
});

export default router; 