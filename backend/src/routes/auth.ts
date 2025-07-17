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
      console.log('❌ SAML Authentication failed:', err);
      return res.redirect(`${config.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔍 COMPLETE SAML DATA ANALYSIS');
    console.log('='.repeat(80));
    
    // 1. Basic SAML info
    console.log(`📋 NameID: ${profile.nameID}`);
    console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
    console.log(`📋 Session Index: ${profile.sessionIndex}`);
    
    // 2. Get all attributes
    const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
    console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
    console.log('📊 All SAML Attributes:');
    for (const [key, value] of Object.entries(samlAttributes)) {
      console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
    }
    
    // 3. Raw profile analysis
    console.log('\n📄 Raw Profile Object:');
    console.log(JSON.stringify(profile, null, 2));
    
    console.log('='.repeat(80));
    console.log('🔍 END SAML DATA ANALYSIS');
    console.log('='.repeat(80) + '\n');

    try {
      // === Enhanced SAML attributes mapping เหมือน Python ===
      console.log('\n🔍 Raw SAML Attributes:');
      for (const [key, value] of Object.entries(samlAttributes)) {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }

      const getAttr = (keyArr: string[], fallback?: any) => {
        for (const key of keyArr) {
          if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
            return samlAttributes[key][0];
          }
          if (samlAttributes[key] && !Array.isArray(samlAttributes[key])) {
            return samlAttributes[key];
          }
        }
        return fallback;
      };

      // Try different common SAML attribute formats, including the one with typo
      const username = (
        getAttr(['User.Userrname']) ||  // Note: This is the actual attribute name with typo
        getAttr(['User.Username']) ||
        getAttr(['username']) ||
        getAttr(['uid'])
      );
      const email = (
        getAttr(['User.Email']) ||
        getAttr(['email']) ||
        getAttr(['mail'])
      );
      const firstName = (
        getAttr(['first_name']) ||
        getAttr(['firstname']) ||
        getAttr(['givenName'])
      );
      const lastName = (
        getAttr(['last_name']) ||
        getAttr(['lastname']) ||
        getAttr(['sn'])
      );
      const department = (
        getAttr(['depart_name']) ||
        getAttr(['department']) ||
        getAttr(['organizationalUnit'])
      );
      
      // ปรับปรุง groups mapping ให้ถูกต้อง
      let groups = [];
      const groupsAttr = getAttr(['Groups']); // ใช้ Groups string attribute
      const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']); // ใช้ Group SIDs array
      
      console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
      console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
      
      if (groupsAttr) {
        // ถ้ามี Groups string ให้ใช้เป็นหลัก
        groups = [groupsAttr];
        console.log(`🔍 Groups mapping - Using Groups string: ${groupsAttr}`);
      } else if (groupSids && Array.isArray(groupSids)) {
        // ถ้าไม่มี Groups string ให้ใช้ Group SIDs
        groups = groupSids;
        console.log(`🔍 Groups mapping - Using Group SIDs array: ${JSON.stringify(groupSids)}`);
      } else if (groupSids && !Array.isArray(groupSids)) {
        // ถ้า Group SIDs ไม่ใช่ array
        groups = [groupSids];
        console.log(`🔍 Groups mapping - Using Group SIDs single: ${groupSids}`);
      }

      // Ensure groups is always an array
      const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
      console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);

      if (!username) {
        console.log('❌ Username not found in SAML attributes');
        return res.redirect(`${config.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
      }

      // Print mapped values for debugging
      console.log('\n🔍 Mapped Values:');
      console.log(`   Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   First Name: ${firstName}`);
      console.log(`   Last Name: ${lastName}`);
      console.log(`   Department: ${department}`);
      console.log(`   Groups: ${JSON.stringify(groupsArray)}`);

      // === สร้าง user profile และ save ลง DB ===
      const userProfile = {
        nameID: profile.nameID,
        username,
        email,
        firstName,
        lastName,
        department,
        groups: groupsArray,
      };
      
      console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
      
      // ใช้ userService จริง
      const user = await userService.find_or_create_saml_user(userProfile);
      console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
      
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
      
      const redirect_url = `${config.FRONTEND_URL}/auth/callback?token=${token}`;
      console.log(`🔄 Redirecting to: ${redirect_url}`);
      return res.redirect(redirect_url);
    } catch (e: any) {
      console.log(`❌ Error processing SAML attributes: ${e}`);
      return res.redirect(`${config.FRONTEND_URL}/login?error=token_creation&reason=${encodeURIComponent(e.message)}`);
    }
  })(req, res, next);
});

// SAML Callback GET route (for compatibility)
router.get('/saml/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('saml', async (err: any, profile: any, info: any) => {
    if (err || !profile) {
      console.log('❌ SAML Authentication failed:', err);
      return res.redirect(`${config.FRONTEND_URL}/login?error=auth_failed&reason=${encodeURIComponent(err?.message || 'No profile')}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔍 COMPLETE SAML DATA ANALYSIS (GET)');
    console.log('='.repeat(80));
    
    // 1. Basic SAML info
    console.log(`📋 NameID: ${profile.nameID}`);
    console.log(`📋 NameID Format: ${profile.nameIDFormat}`);
    console.log(`📋 Session Index: ${profile.sessionIndex}`);
    
    // 2. Get all attributes
    const samlAttributes = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims'] || profile.attributes || {};
    console.log(`\n📊 Total Attributes Found: ${Object.keys(samlAttributes).length}`);
    console.log('📊 All SAML Attributes:');
    for (const [key, value] of Object.entries(samlAttributes)) {
      console.log(`   🔑 ${key}: ${JSON.stringify(value)}`);
    }
    
    // 3. Raw profile analysis
    console.log('\n📄 Raw Profile Object:');
    console.log(JSON.stringify(profile, null, 2));
    
    console.log('='.repeat(80));
    console.log('🔍 END SAML DATA ANALYSIS (GET)');
    console.log('='.repeat(80) + '\n');

    try {
      // === Enhanced SAML attributes mapping เหมือน Python ===
      console.log('\n🔍 Raw SAML Attributes:');
      for (const [key, value] of Object.entries(samlAttributes)) {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }

      const getAttr = (keyArr: string[], fallback?: any) => {
        for (const key of keyArr) {
          if (samlAttributes[key] && Array.isArray(samlAttributes[key]) && samlAttributes[key][0]) {
            return samlAttributes[key][0];
          }
          if (samlAttributes[key] && !Array.isArray(samlAttributes[key])) {
            return samlAttributes[key];
          }
        }
        return fallback;
      };

      // Try different common SAML attribute formats, including the one with typo
      const username = (
        getAttr(['User.Userrname']) ||  // Note: This is the actual attribute name with typo
        getAttr(['User.Username']) ||
        getAttr(['username']) ||
        getAttr(['uid'])
      );
      const email = (
        getAttr(['User.Email']) ||
        getAttr(['email']) ||
        getAttr(['mail'])
      );
      const firstName = (
        getAttr(['first_name']) ||
        getAttr(['firstname']) ||
        getAttr(['givenName'])
      );
      const lastName = (
        getAttr(['last_name']) ||
        getAttr(['lastname']) ||
        getAttr(['sn'])
      );
      const department = (
        getAttr(['depart_name']) ||
        getAttr(['department']) ||
        getAttr(['organizationalUnit'])
      );
      
      // ปรับปรุง groups mapping ให้ถูกต้อง
      let groups = [];
      const groupsAttr = getAttr(['Groups']); // ใช้ Groups string attribute
      const groupSids = getAttr(['http://schemas.xmlsoap.org/claims/Group']); // ใช้ Group SIDs array
      
      console.log(`🔍 Groups mapping - Groups attr: ${JSON.stringify(groupsAttr)}`);
      console.log(`🔍 Groups mapping - Group SIDs: ${JSON.stringify(groupSids)}`);
      
      if (groupsAttr) {
        // ถ้ามี Groups string ให้ใช้เป็นหลัก
        groups = [groupsAttr];
        console.log(`🔍 Groups mapping - Using Groups string: ${groupsAttr}`);
      } else if (groupSids && Array.isArray(groupSids)) {
        // ถ้าไม่มี Groups string ให้ใช้ Group SIDs
        groups = groupSids;
        console.log(`🔍 Groups mapping - Using Group SIDs array: ${JSON.stringify(groupSids)}`);
      } else if (groupSids && !Array.isArray(groupSids)) {
        // ถ้า Group SIDs ไม่ใช่ array
        groups = [groupSids];
        console.log(`🔍 Groups mapping - Using Group SIDs single: ${groupSids}`);
      }

      // Ensure groups is always an array
      const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
      console.log(`🔍 Groups mapping - Final groups array: ${JSON.stringify(groupsArray)}`);

      if (!username) {
        console.log('❌ Username not found in SAML attributes');
        return res.redirect(`${config.FRONTEND_URL}/login?error=profile_mapping&reason=Username not found in SAML attributes`);
      }

      // Print mapped values for debugging
      console.log('\n🔍 Mapped Values:');
      console.log(`   Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   First Name: ${firstName}`);
      console.log(`   Last Name: ${lastName}`);
      console.log(`   Department: ${department}`);
      console.log(`   Groups: ${JSON.stringify(groupsArray)}`);

      // === สร้าง user profile และ save ลง DB ===
      const userProfile = {
        nameID: profile.nameID,
        username,
        email,
        firstName,
        lastName,
        department,
        groups: groupsArray,
      };
      
      console.log(`\n👤 Mapped Profile: ${JSON.stringify(userProfile, null, 2)}`);
      
      // ใช้ userService จริง
      const user = await userService.find_or_create_saml_user(userProfile);
      console.log(`👤 Created/Found User: ${user.username} (${user.email})`);
      
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
      
      const redirect_url = `${config.FRONTEND_URL}/auth/callback?token=${token}`;
      console.log(`🔄 Redirecting to: ${redirect_url}`);
      return res.redirect(redirect_url);
    } catch (e: any) {
      console.log(`❌ Error processing SAML attributes: ${e}`);
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
  const { name_id, session_index } = req.query;
  console.log(`SAML logout requested - name_id: ${name_id}, session_index: ${session_index}`);
  
  // For now, redirect to simple logout
  // TODO: Implement proper SAML SLO when needed
  return res.redirect(`${config.FRONTEND_URL}/login?logged_out=true`);
});

// SAML Logout Manual Return
router.get('/logout/saml/manual', (req: Request, res: Response) => {
  console.log('Manual return from SAML logout');
  return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true&manual=true`);
});

// SAML Logout Callback
router.post('/logout/saml/callback', (req: Request, res: Response) => {
  console.log('SAML logout callback received (POST)');
  return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true`);
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
    return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true`);
  }
  
  // For now, assume logout succeeded
  return res.redirect(`${config.FRONTEND_URL}/login?saml_logged_out=true`);
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