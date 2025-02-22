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

// Add enhanced logging middleware
router.use('/saml/callback', (req, res, next) => {
  console.log('=== SAML Callback Request Debug ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('================================');
  next();
});

// Define role mapping function
const mapGroupToRole = async (groups: string[], nameID: string): Promise<UserRole> => {
  console.log('=== Role Mapping Debug ===');
  console.log('Input groups:', groups);
  
  // First check if user already exists and has ADMIN role
  try {
    const existingUser = await User.findOne({ nameID });
    if (existingUser && existingUser.role === 'ADMIN') {
      console.log('Preserving existing ADMIN role for user');
      return 'ADMIN';
    }
  } catch (error) {
    console.error('Error checking existing user role:', error);
  }

  // Check if groups is empty or undefined
  if (!groups || groups.length === 0) {
    console.log('No groups provided, defaulting to Students role');
    return 'Students';
  }

  // Check for student group ID
  const isStudent = groups.some(group => 
    group === 'S-1-5-21-893890582-1041674030-1199480097-43779'
  );

  if (isStudent) {
    console.log('Found student group ID - assigning Students role');
    return 'Students';
  }

  // If not student group, assign Staffs role
  console.log('No student group found - assigning Staffs role');
  return 'Staffs';
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
      console.log(profile);

      // Extract user information from SAML profile
      const nameID = profile.nameID;
      const email = profile.email || profile['urn:oid:0.9.2342.19200300.100.1.3'];
      const username = profile.username || profile['urn:oid:0.9.2342.19200300.100.1.1'];
      const firstName = profile['urn:oid:2.5.4.42'] || profile.firstName;
      const lastName = profile['urn:oid:2.5.4.4'] || profile.lastName;
      const groups = profile['urn:oid:1.3.6.1.4.1.5923.1.5.1.1'] || [];

      // Determine final values with fallbacks
      const finalNameID = nameID || email || username;
      const finalUsername = username || email?.split('@')[0] || nameID;

      if (!finalNameID) {
        console.error('Missing nameID and no fallback available');
        console.error('Available profile data:', profile);
        return done(new Error('Missing required user information: nameID'));
      }

      if (!finalUsername) {
        console.error('Missing username and no fallback available');
        console.error('Available profile data:', profile);
        return done(new Error('Missing required user information: username'));
      }

      // Get role based on groups
      const role = await mapGroupToRole(Array.isArray(groups) ? groups : [groups], finalNameID);

      // Update user in database
      const user = await User.findOneAndUpdate(
        { nameID: finalNameID },
        {
          nameID: finalNameID,
          username: finalUsername,
          email: email || finalUsername,
          firstName: firstName || '',
          lastName: lastName || '',
          groups: Array.isArray(groups) ? groups : [groups],
          role: role,
          updated: new Date()
        },
        { upsert: true, new: true }
      );

      console.log('=== Created/Updated User ===');
      console.log(user);

      const userData = {
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        groups: user.groups,
        role: user.role
      };

      const token = jwt.sign(
        {
          userId: user._id,
          nameID: userData.nameID,
          username: userData.username,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          groups: userData.groups || []
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      return done(null, { token, userData });

    } catch (error) {
      console.error('SAML Strategy Error:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : '');
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
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('saml', async (err: Error | null, user: { userData: SamlUserData; token?: string } | false, info: any) => {
      if (err) {
        console.error('SAML Authentication Error:', err);
        return res.redirect('/login?error=' + encodeURIComponent(err.message));
      }
      
      if (!user) {
        console.error('No user data received from SAML');
        return res.redirect('/login?error=authentication_failed');
      }

      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error('Login Error:', loginErr);
          return res.redirect('/login?error=' + encodeURIComponent(loginErr.message));
        }

        try {
          const userData = user.userData;
          if (!userData) {
            throw new Error('No user data provided');
          }

          const role = await mapGroupToRole(userData.groups || [], userData.nameID);

          const userInfo = {
            nameID: userData.nameID,
            username: userData.username,
            email: userData.email,
            firstName: userData.first_name,
            lastName: userData.last_name,
            role: role
          };

          const updatedUser = await User.findOneAndUpdate(
            { nameID: userInfo.nameID },
            {
              ...userInfo,
              groups: userData.groups || [],
              updated: new Date()
            },
            { upsert: true, new: true }
          );

          if (!updatedUser) {
            throw new Error('User not found in database');
          }

          const token = jwt.sign(
            {
              userId: updatedUser._id,
              nameID: userInfo.nameID,
              username: userInfo.username,
              email: userInfo.email,
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              role: userInfo.role,
              groups: userData.groups || []
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
          );

          const encodedUserData = Buffer.from(JSON.stringify(userInfo)).toString('base64');
          
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const redirectUrl = new URL(`${frontendUrl}/auth-callback`);
          redirectUrl.searchParams.append('token', token);
          redirectUrl.searchParams.append('user_data', encodedUserData);

          console.log('Redirecting to:', redirectUrl.toString());
          res.redirect(redirectUrl.toString());
        } catch (error) {
          console.error('SAML Callback Error:', error);
          res.redirect('/login?error=processing_failed');
        }
      });
    })(req, res, next);
  }
);

const getMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    const user = await User.findOne({ nameID: decoded.nameID });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      userId: user._id,
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      groups: user.groups
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

// Add debug route
router.get('/debug/saml-config', (req, res) => {
  try {
    // Only show non-sensitive configuration
    const debugConfig = {
      issuer: samlConfig.issuer,
      callbackUrl: samlConfig.callbackUrl,
      entryPoint: samlConfig.entryPoint,
      identifierFormat: samlConfig.identifierFormat,
      wantAssertionsSigned: samlConfig.wantAssertionsSigned,
      acceptedClockSkewMs: samlConfig.acceptedClockSkewMs,
      validateInResponseTo: samlConfig.validateInResponseTo,
      disableRequestedAuthnContext: samlConfig.disableRequestedAuthnContext,
      authnContext: samlConfig.authnContext,
      forceAuthn: samlConfig.forceAuthn,
      passReqToCallback: samlConfig.passReqToCallback,
      additionalParams: samlConfig.additionalParams,
      signatureAlgorithm: samlConfig.signatureAlgorithm
    };

    res.json({
      config: debugConfig,
      env: {
        FRONTEND_URL: process.env.FRONTEND_URL,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('Error in debug route:', error);
    res.status(500).json({ error: 'Error getting debug info' });
  }
});

export default router;