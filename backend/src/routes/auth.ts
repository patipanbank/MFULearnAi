import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy, Profile as SamlProfile } from 'passport-saml';
import { getSamlConfig } from '../services/samlService';
import { userService } from '../services/userService';
import { authenticateJWT, requireAnyRole, requireAdminRole } from '../middleware/auth';
import config from '../config/config';
import jwt from 'jsonwebtoken';

const router = Router();

// SAML Strategy
passport.use('saml', new SamlStrategy(getSamlConfig(), (profile: SamlProfile | null | undefined, done: (err: any, user?: any) => void) => {
  return done(null, profile || undefined);
}));

// SAML Login
router.get('/login/saml', passport.authenticate('saml', { failureRedirect: '/login', failureFlash: true }));

// SAML Callback (mapping, JWT, redirect, error handling)
router.post('/saml/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('saml', async (err: any, profile: any, info: any) => {
    if (err || !profile) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
    }
    try {
      // === Mapping SAML attributes เหมือน Python ===
      const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
      const getAttr = (keyArr: string[], fallback?: any) => {
        for (const key of keyArr) {
          if (samlAttributes[key] && samlAttributes[key][0]) return samlAttributes[key][0];
        }
        return fallback;
      };
      const username = getAttr(['User.Userrname', 'User.Username', 'username', 'uid']);
      const email = getAttr(['User.Email', 'email', 'mail']);
      const firstName = getAttr(['first_name', 'firstname', 'givenName']);
      const lastName = getAttr(['last_name', 'lastname', 'sn']);
      const department = getAttr(['depart_name', 'department', 'organizationalUnit']);
      const groups = getAttr(['http://schemas.xmlsoap.org/claims/Group', 'groups', 'Groups', 'memberOf'], []);
      if (!username) {
        return res.redirect(`${config.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
      }
      
      // === สร้าง user profile และ save ลง DB ===
      const userProfile = {
        nameID: profile.nameID,
        username,
        email,
        firstName,
        lastName,
        department,
        groups,
      };
      
      // ใช้ userService จริง
      const user = await userService.find_or_create_saml_user(userProfile);
      
      // === สร้าง JWT payload ===
      const tokenPayload = {
        sub: user._id,
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
      const token = jwt.sign(tokenPayload, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });
      // === Redirect ===
      return res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (e: any) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(e.message)}`);
    }
  })(req, res, next);
});

// SAML Metadata
router.get('/metadata', (req: Request, res: Response) => {
  const samlStrategy = new SamlStrategy(getSamlConfig(), (() => {}) as any);
  res.type('application/xml');
  const cert = config.SAML_CERTIFICATE ? config.SAML_CERTIFICATE.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, '').trim() : undefined;
  if (cert) {
    res.send(samlStrategy.generateServiceProviderMetadata(cert));
  } else {
    res.send(samlStrategy.generateServiceProviderMetadata(null));
  }
});

// SAML Logout (redirect/logout SAML)
router.get('/logout/saml', (req: Request, res: Response) => {
  return res.redirect(`${config.FRONTEND_URL}/login?logged_out=true`);
});

// Admin Login (JWT) - เหมือน FastAPI /admin/login
router.post('/admin/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  // ใช้ userService จริง
  const user = await userService.find_admin_by_username(username);
  if (!user || !user.password) {
    return res.status(401).json({ detail: 'User account not found or password not set' });
  }
  
  const isMatch = await userService.verify_admin_password(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ detail: 'Password is incorrect' });
  }
  
  // สร้าง JWT payload เหมือน Python
  const tokenPayload = {
    sub: user._id,
    nameID: user.nameID,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    department: user.department,
    groups: user.groups,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 1 วัน
  };
  
  const token = jwt.sign(tokenPayload, config.JWT_SECRET, { algorithm: config.JWT_ALGORITHM as jwt.Algorithm });
  
  return res.json({ token, user: { ...user.toObject(), password: undefined } });
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
  return res.redirect(`${config.FRONTEND_URL}/login?logged_out=true`);
});

export default router; 