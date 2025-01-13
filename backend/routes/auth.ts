import { Router } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';

const router = Router();

// เพิ่ม logging middleware
router.use('/saml/callback', (req, res, next) => {
  console.log('SAML Callback Request:', req.body);
  next();
});

const samlStrategy = new SamlStrategy(
  {
    issuer: process.env.SAML_SP_ENTITY_ID,
    callbackUrl: process.env.SAML_SP_ACS_URL,
    entryPoint: process.env.SAML_IDP_SSO_URL,
    logoutUrl: process.env.SAML_IDP_SLO_URL,
    cert: process.env.SAML_CERTIFICATE || '',
    disableRequestedAuthnContext: true,
    forceAuthn: false,
    identifierFormat: null,
    wantAssertionsSigned: true,
    acceptedClockSkewMs: -1,
    validateInResponseTo: false,
    passReqToCallback: true
  },
  async function(req: any, profile: any, done: any) {
    try {
      await connectDB();
      
      const nameID = profile['User.Username'];
      const email = profile['User.Enmail'];
      const firstName = profile['first_name'];
      const lastName = profile['last_name'];

      console.log('SAML Profile:', {
        raw: profile,
        mapped: { nameID, email, firstName, lastName }
      });

      if (!nameID || !email) {
        console.error('Missing required user information:', { nameID, email });
        return done(new Error('Missing required user information'));
      }

      let user = await User.findOne({ nameID });
      
      if (!user) {
        user = await User.create({
          nameID,
          email,
          firstName,
          lastName
        });
      }

      return done(null, user);
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
  passport.authenticate('saml', { session: false }),
  async (req: any, res) => {
    try {
      console.log('Authentication Success, User:', req.user);
      
      const token = jwt.sign(
        { 
          userId: req.user._id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      res.redirect(`${process.env.FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Token Generation Error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.SAML_IDP_SLO_URL || '/');
  });
});

router.get('/logout/saml', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.SAML_IDP_SLO_URL || 'https://authsso.mfu.ac.th/adfs/ls/?wa=wsignout1.0');
  });
});

router.get('/metadata', (req, res) => {
  const metadata = samlStrategy.generateServiceProviderMetadata(null, process.env.SAML_CERTIFICATE);
  res.type('application/xml');
  res.send(metadata);
});

export default router;
