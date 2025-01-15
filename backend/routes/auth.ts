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

router.post('/saml/callback', async (req, res) => {
  passport.authenticate('saml', { session: false }, async (err: any, profile: any) => {
    if (err) {
      console.error('SAML Authentication Error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    try {
      // สร้าง user data object
      const userData = {
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        groups: profile.groups
      };

      // สร้าง token
      const token = jwt.sign(
        { iat: Date.now(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000) }, // 7 วัน
        process.env.JWT_SECRET || 'your-secret-key'
      );

      // Log เพื่อตรวจสอบข้อมูล
      console.log('User data being sent:', userData);
      
      // ส่งข้อมูลกลับไปที่ frontend
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`);
      redirectUrl.searchParams.append('token', token);
      redirectUrl.searchParams.append('user_data', JSON.stringify(userData));
      
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Error in SAML callback:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  })(req, res);
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