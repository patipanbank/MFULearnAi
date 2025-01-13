import { Router } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';
import express from 'express';

const router = Router();

const cert = process.env.SAML_CERTIFICATE;
if (!cert) {
  throw new Error('SAML_CERTIFICATE is required in .env file');
}

// เพิ่ม logging middleware
router.use('/saml/callback', (req, res, next) => {
  console.log('SAML Callback Request:', {
    body: req.body,
    method: req.method,
    headers: req.headers
  });
  next();
});

const samlStrategy = new SamlStrategy(
  {
    issuer: process.env.SAML_SP_ENTITY_ID,
    callbackUrl: process.env.SAML_SP_ACS_URL,
    entryPoint: process.env.SAML_IDP_SSO_URL,
    logoutUrl: process.env.SAML_IDP_SLO_URL,
    idpIssuer: process.env.SAML_IDP_ENTITY_ID,
    cert: cert,
    disableRequestedAuthnContext: true,
    forceAuthn: false,
    identifierFormat: null,
    wantAssertionsSigned: true,
    acceptedClockSkewMs: -1,
    validateInResponseTo: false,
    passReqToCallback: true
  },
  (req: any, profile: any, done: any) => {
    console.log('SAML Profile:', profile);
    connectDB().then(() => {
      User.findOne({ email: profile.email })
        .then(user => {
          if (!user) {
            return User.create({
              email: profile.email,
              name: profile.displayName || profile.email,
              samlId: profile.nameID
            });
          }
          return user;
        })
        .then(user => done(null, user))
        .catch(error => done(error));
    });
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
router.get('/login/saml', passport.authenticate('saml'));

// SAML Callback route
router.post('/saml/callback',
  express.urlencoded({ extended: false }),
  (req, res, next) => {
    console.log('SAML Response:', req.body.SAMLResponse);
    next();
  },
  passport.authenticate('saml', { 
    failureRedirect: '/login',
    failureFlash: true,
    session: false 
  }),
  (req: any, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id, email: req.user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      res.redirect(`${process.env.FRONTEND_URL}/auth-callback?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Token Error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
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
