import { Router, urlencoded } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

// ตรวจสอบ env variables
if (!process.env.SAML_CERTIFICATE || 
    !process.env.SAML_IDP_SSO_URL || 
    !process.env.SAML_SP_ENTITY_ID || 
    !process.env.SAML_SP_ACS_URL ||
    !process.env.JWT_SECRET) {
  throw new Error('Missing required environment variables');
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
    wantAssertionsSigned: false
  },
  async (profile: any, done: any) => {
    try {
      console.log('SAML Profile:', profile);
      
      // ปรับการอ่านค่าตาม LDAP attributes
      const userData = {
        email: profile['User.Enmail'] || profile.email,
        username: profile['User.Username'] || profile.nameID,
        firstName: profile['first_name'] || profile.givenName,
        lastName: profile['last_name'] || profile.surname,
        displayName: profile.displayName || `${profile['first_name']} ${profile['last_name']}`
      };

      console.log('Mapped user data:', userData);

      let user = await User.findOne({ email: userData.email });
      
      if (!user) {
        user = await User.create({
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: userData.displayName
        });
      } else {
        // อัพเดทข้อมูลผู้ใช้ที่มีอยู่
        user.firstName = userData.firstName;
        user.lastName = userData.lastName;
        user.displayName = userData.displayName;
        await user.save();
      }
      
      return done(null, user);
    } catch (error) {
      console.error('User processing error:', error);
      done(error);
    }
  }
);

passport.use(samlStrategy);

// Login route
router.get('/login/saml', (req, res, next) => {
  console.log('Starting SAML login...');
  passport.authenticate('saml')(req, res, next);
});

// Callback route
router.post('/saml/callback',
  urlencoded({ extended: false }),
  passport.authenticate('saml', { session: false }),
  async (req: any, res) => {
    try {
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
      
      res.redirect(`${process.env.FRONTEND_URL}/auth-callback?token=${token}`);
    } catch (error) {
      console.error('Token generation error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=token_error`);
    }
  }
);

export default router;
