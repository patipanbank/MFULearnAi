import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy, SamlConfig } from 'passport-saml';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User, { UserRole } from '../models/User';
import { guest_login } from '../controllers/user_controller';

const router = Router();

interface SamlUserData {
  nameID: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  groups?: string[];
}

interface AuthRequest extends Request {
  user?: {
    userData: SamlUserData;
    token?: string;
  };
}

// เพิ่ม logging middleware
router.use('/saml/callback', (req, res, next) => {
  console.log('SAML Callback Request:', req.body);
  next();
});

// Define role mapping function
const mapGroupToRole = (groups: string[]): UserRole => {
  // Admin group check
  const isAdmin = groups.some(group => 
    group === 'S-1-5-21-893890582-1041674030-1199480097-13779' // Replace with actual admin group ID
  );
  
  // Staff group check (anyone not in student group is staff)
  const isStudent = groups.some(group => 
    group === 'S-1-5-21-893890582-1041674030-1199480097-43779'
  );

  if (isAdmin) return 'ADMIN';
  if (!isStudent) return 'STAFF';
  return 'USER';
};

if (!process.env.SAML_SP_ENTITY_ID || !process.env.SAML_SP_ACS_URL || !process.env.SAML_IDP_SSO_URL) {
  throw new Error('Required SAML configuration is missing');
}

const samlConfig: SamlConfig = {
  issuer: process.env.SAML_SP_ENTITY_ID,
  callbackUrl: process.env.SAML_SP_ACS_URL,
  entryPoint: process.env.SAML_IDP_SSO_URL,
  logoutUrl: process.env.SAML_IDP_SLO_URL || undefined,
  cert: process.env.SAML_CERTIFICATE?.replace(/\\n/g, '\n') || '',
  disableRequestedAuthnContext: true,
  forceAuthn: false,
  identifierFormat: process.env.SAML_IDENTIFIER_FORMAT || 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  wantAssertionsSigned: true,
  acceptedClockSkewMs: 300000, // 5 minutes clock skew
  validateInResponseTo: false,
  passReqToCallback: true,
  signatureAlgorithm: 'sha256',
  additionalParams: {
    RelayState: process.env.FRONTEND_URL || ''
  },
  authnContext: [
    'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
    'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
  ],
  racComparison: 'exact'
};

const samlStrategy = new SamlStrategy(
  samlConfig,
  async function(req: any, profile: any, done: any) {
    try {
      console.log('=== SAML Profile Debug ===');
      console.log(JSON.stringify(profile, null, 2));

      // Extract user information from profile
      const nameID = profile.nameID || profile.nameId;
      const username = profile['User.Username'] || 
                      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'];
      const email = profile['User.Email'] || 
                   profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                   profile['emailaddress'];
      const firstName = profile['first_name'] || 
                       profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
                       profile['givenname'];
      const lastName = profile['last_name'] || 
                      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] ||
                      profile['surname'];
      const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || 
                    profile['groups'] ||
                    profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || 
                    [];

      console.log('=== Extracted Values ===');
      console.log({
        nameID,
        username,
        email,
        firstName,
        lastName,
        groups
      });

      if (!nameID || !username) {
        console.error('Missing required fields:', { nameID, username });
        return done(new Error('Missing required user information'));
      }

      // Update user in database
      const user = await User.findOneAndUpdate(
        { username },
        {
          nameID,
          username,
          email,
          firstName,
          lastName,
          groups: Array.isArray(groups) ? groups : [groups],
          role: mapGroupToRole(Array.isArray(groups) ? groups : [groups]),
          updated: new Date()
        },
        { upsert: true, new: true }
      );

      const token = jwt.sign(
        { 
          userId: user._id,
          username: user.username,
          role: user.role
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      const userData = {
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        groups: user.groups,
        role: user.role
      };

      return done(null, { token, userData });

    } catch (error) {
      console.error('SAML Strategy Error:', error);
      return done(error);
    }
  }
);

passport.use(samlStrategy);

passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

router.get('/login/saml', passport.authenticate('saml'));

router.post('/saml/callback', 
  passport.authenticate('saml', { session: false }) as RequestHandler,
  (async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userData = req.user?.userData;
      if (!userData) {
        throw new Error('No user data provided');
      }

      const role = mapGroupToRole(userData.groups || []);

      const userInfo = {
        nameID: userData.nameID,
        username: userData.username,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: role
      };

      await User.findOneAndUpdate(
        { username: userInfo.username },
        {
          ...userInfo,
          groups: userData.groups || [],
          updated: new Date()
        },
        { upsert: true }
      );

      const token = jwt.sign(
        userInfo,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      const encodedUserData = Buffer.from(JSON.stringify(userInfo)).toString('base64');
      
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth-callback`);
      redirectUrl.searchParams.append('token', token);
      redirectUrl.searchParams.append('user_data', encodedUserData);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      next(error);
    }
  }) as RequestHandler);

const getMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    const user = await User.findOne({ username: decoded.username });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      username: user.username,
      role: user.role as UserRole
    });
  } catch (error) {
    next(error);
  }
};

router.get('/me', getMeHandler);

router.post('/logout', (req, res) => {
  req.logout(() => {
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.SAML_IDP_SLO_URL || '/');
  });
});

router.get('/logout/saml', (req, res) => {
  req.logout(() => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://mfulearnai.mfu.ac.th';
    const returnUrl = encodeURIComponent(`${frontendUrl}/login`);
    const logoutUrl = `${process.env.SAML_IDP_SLO_URL}&wreply=${returnUrl}`;
    
    res.redirect(logoutUrl);
  });
});

router.get('/metadata', (req, res) => {
  try {
    const metadata = samlStrategy.generateServiceProviderMetadata(
      null, 
      process.env.SAML_CERTIFICATE?.replace(/\\n/g, '\n')
    );
    res.type('application/xml');
    res.send(metadata);
  } catch (error) {
    console.error('Error generating metadata:', error);
    res.status(500).send('Error generating metadata');
  }
});

router.post('/test', guest_login);

router.post('/saml/callback', (req, res, next) => {
  console.log('=== SAML Callback Debug ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('=========================');
  next();
});

export default router;