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

      // ปรับการอ่านค่าให้ตรงกับ SAML response
      const nameID = profile.nameID;
      const email = profile['User.Email'];
      const firstName = profile['first_name'];
      const lastName = profile['last_name'];
      const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];

      console.log('=== Extracted Values ===');
      console.log({
        nameID,
        email,
        firstName,
        lastName,
        groups
      });

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
          groups: Array.isArray(groups) ? groups : [groups],
          updated: new Date()
        },
        { upsert: true, new: true }
      );

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      const userData = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        groups: user.groups
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

router.post('/saml/callback', (req, res, next) => {
  passport.authenticate('saml', (err: Error | null, data: any) => {
    if (err) {
      console.error('SAML Callback Error:', err);
      return res.redirect('/login?error=auth_failed');
    }
    if (!data) {
      return res.redirect('/login?error=no_data');
    }

    // สร้าง userData object
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      groups: data.groups
    };

    // แปลงเป็น JSON string และ encode
    const userDataString = encodeURIComponent(JSON.stringify(userData));
    
    // ส่ง token และ userData กลับไป frontend
    res.redirect(`/auth/callback?token=${data.token}&user_data=${userDataString}`);
  })(req, res, next);
});

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
