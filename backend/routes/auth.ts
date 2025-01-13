import { Router, urlencoded } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';

const router = Router();

if (!process.env.SAML_CERTIFICATE || 
    !process.env.SAML_IDP_SSO_URL || 
    !process.env.SAML_SP_ENTITY_ID || 
    !process.env.SAML_SP_ACS_URL) {
  throw new Error('Missing required SAML environment variables');
}

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is required');
}

const samlStrategy = new SamlStrategy(
  {
    entryPoint: process.env.SAML_IDP_SSO_URL,
    issuer: process.env.SAML_SP_ENTITY_ID,
    callbackUrl: process.env.SAML_SP_ACS_URL,
    cert: process.env.SAML_CERTIFICATE,
    acceptedClockSkewMs: -1,
    disableRequestedAuthnContext: true,
    forceAuthn: false,
    validateInResponseTo: false,
    identifierFormat: null,
    wantAssertionsSigned: false,
    logoutUrl: 'https://authsso.mfu.ac.th/adfs/ls/?wa=wsignout1.0'
  },
  async (profile: any, done: any) => {
    try {
      console.log('SAML Profile:', profile);
      await connectDB();
      
      // รับค่าจาก SAML attributes
      const userData = {
        email: profile['User.Email'],
        username: profile['User.Username'],
        firstName: profile['first_name'],
        lastName: profile['last_name'],
        displayName: `${profile['first_name']} ${profile['last_name']}`
      };

      // ค้นหาหรือสร้าง user
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = await User.create({
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName,
          samlId: profile.nameID
        });
      }

      done(null, user);
    } catch (error) {
      console.error('SAML Error:', error);
      done(error);
    }
  }
);

samlStrategy.error = (err: any) => {
  console.error('SAML Strategy Error:', err);
};

passport.use('saml', samlStrategy);

// Serialize & Deserialize User
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Login route
router.get('/login/saml', (req, res, next) => {
  console.log('Starting SAML login...');
  try {
    passport.authenticate('saml', {
      failureRedirect: `${process.env.FRONTEND_URL}/login`,
      failureFlash: true,
      keepSessionInfo: true
    })(req, res, next);
  } catch (error) {
    console.error('SAML Login Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_error`);
  }
});

// Callback route
router.post('/saml/callback',
  urlencoded({ extended: false }),
  (req: any, res, next) => {
    console.log('1. Received SAML callback');
    console.log('2. Processing SAML response');
    next();
  },
  passport.authenticate('saml', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    failureFlash: true,
    session: false
  }),
  async (req: any, res) => {
    try {
      console.log('3. SAML authentication successful');
      const user = req.user;
      console.log('4. Creating JWT token');
      
      const token = jwt.sign(
        { 
          userId: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      console.log('5. Redirecting to frontend with token');
      res.redirect(`${process.env.FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Error in callback processing:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_error`);
    }
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('https://authsso.mfu.ac.th/adfs/ls/?wa=wsignout1.0');
  });
});

// Metadata route
router.get('/metadata', (req, res) => {
  const metadata = samlStrategy.generateServiceProviderMetadata(null, process.env.SAML_CERTIFICATE);
  res.type('application/xml');
  res.send(metadata);
});

export default router;
