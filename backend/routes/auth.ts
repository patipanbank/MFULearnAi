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
    identifierFormat: process.env.SAML_IDENTIFIER_FORMAT || 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    wantAssertionsSigned: false
  },
  async (profile: any, done: any) => {
    console.log('SAML Profile received:', profile);
    try {
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
      console.error('SAML Strategy Error:', error);
      done(error);
    }
  }
);

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
  console.log('Starting SAML login with options:', {
    entryPoint: process.env.SAML_IDP_SSO_URL,
    issuer: process.env.SAML_SP_ENTITY_ID,
    callbackUrl: process.env.SAML_SP_ACS_URL
  });
  
  passport.authenticate('saml', {
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    failureFlash: true
  })(req, res, next);
});

// Callback route
router.post('/saml/callback',
  urlencoded({ extended: false }),
  (req: any, res, next) => {
    console.log('=== SAML Callback Debug ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('SAMLResponse:', req.body?.SAMLResponse ? 'Present' : 'Missing');
    console.log('========================');
    next();
  },
  passport.authenticate('saml', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    failureFlash: true,
    failWithError: true
  }, (err: any, user: any, info: any, res: any, next: any) => {
    if (err) {
      console.error('SAML Authentication Error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_error`);
    }
    if (!user) {
      console.error('No user found:', info);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
    }
    
    console.log('Authentication successful for user:', user.email);
    return next();
  }),
  async (req: any, res) => {
    try {
      const user = req.user;
      console.log('Generating token for user:', user.email);
      
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
      
      const redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}`;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Token generation/redirect error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=token_error`);
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
