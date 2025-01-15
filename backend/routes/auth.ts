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
      console.log('=== SAML Profile Debug ===');
      console.log(JSON.stringify(profile, null, 2));

      // ค่าพื้นฐาน
      const nameID = profile.nameID || profile['NameID'];
      const email = profile.email || profile['E-Mail-Addresses'];
      const firstName = profile['Given-Name'];
      const lastName = profile.Surname;

      // ปรับการอ่านค่า groups
      let groups = [];
      if (profile['Token-Groups as SIDs']) {
        groups = Array.isArray(profile['Token-Groups as SIDs']) 
          ? profile['Token-Groups as SIDs'] 
          : [profile['Token-Groups as SIDs']];
      } else if (profile.Group) {
        groups = Array.isArray(profile.Group) 
          ? profile.Group 
          : [profile.Group];
      }

      console.log('=== Extracted Groups ===');
      console.log('Raw Groups:', profile['Token-Groups as SIDs'] || profile.Group);
      console.log('Processed Groups:', groups);

      if (!nameID || !email) {
        console.error('Missing required fields:', { nameID, email });
        return done(new Error('Missing required user information'));
      }

      const user = await User.findOneAndUpdate(
        { nameID },
        {
          nameID,
          email,
          firstName,
          lastName,
          groups, // บันทึก groups ที่ได้
          updated: new Date()
        },
        { upsert: true, new: true }
      );

      console.log('=== Saved User Data ===');
      console.log(user);

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      const userData = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        groups: user.groups // ส่งกลับ groups ด้วย
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
      
      const userData = {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      };

      const redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?` + 
        `token=${token}&` +
        `user_data=${encodeURIComponent(JSON.stringify(userData))}`;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error('SAML callback error:', error);
      res.redirect('/login?error=auth_failed');
    }
  }
);

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
  const metadata = samlStrategy.generateServiceProviderMetadata(null, process.env.SAML_CERTIFICATE);
  res.type('application/xml');
  res.send(metadata);
});

router.post('/saml/callback', (req, res, next) => {
  console.log('=== SAML Callback Debug ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('=========================');
  next();
});

export default router;