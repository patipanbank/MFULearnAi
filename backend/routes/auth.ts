import { Router } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';

const router = Router();

const cert = process.env.SAML_CERTIFICATE;
if (!cert) {
  throw new Error('SAML_CERTIFICATE is required in .env file');
}

const samlStrategy = new SamlStrategy(
  {
    // Service Provider (SP) configuration
    issuer: process.env.SAML_SP_ENTITY_ID,
    callbackUrl: process.env.SAML_SP_ACS_URL,
    entryPoint: process.env.SAML_IDP_SSO_URL,
    logoutUrl: process.env.SAML_IDP_SLO_URL,
    
    // Identity Provider (IdP) configuration
    idpIssuer: process.env.SAML_IDP_ENTITY_ID,
    cert: cert,
    
    // Additional settings
    disableRequestedAuthnContext: true,
    forceAuthn: true,
    identifierFormat: null,
    wantAssertionsSigned: true,
    acceptedClockSkewMs: -1,
    validateInResponseTo: false
  },
  async (profile: any, done: any) => {
    console.log('SAML Profile:', profile);
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

// SAML Login route
router.get('/login/saml', (req, res, next) => {
  console.log('Starting SAML login');
  passport.authenticate('saml')(req, res, next);
});

// SAML Callback route
router.post('/saml/callback',
  (req: any, res, next) => {
    console.log('Received SAML callback request');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Raw body:', req.rawBody);
    next();
  },
  passport.authenticate('saml', { 
    failureRedirect: '/login', 
    failureFlash: true,
    session: false 
  }),
  async (req: any, res) => {
    try {
      console.log('Authentication successful');
      console.log('User data:', req.user);
      
      const user = req.user;
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
      
      const redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?token=${token}&redirect=/chatbot`;
      console.log('Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Callback error:', error);
      res.redirect('/login?error=authentication_failed');
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
  const metadata = samlStrategy.generateServiceProviderMetadata(null, cert);
  res.type('application/xml');
  res.send(metadata);
});

export default router;
