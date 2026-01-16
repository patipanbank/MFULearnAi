import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { JWT_SECRET } from '../config/config';
import { ensureDepartmentExists } from '../services/autoDepartment.service';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError, UnauthorizedError } from '../errors';

/**
 * Map SAML groups to role
 */
const mapGroupToRole = (groups: string[]): string => {
  const isStudent = groups.some(group => group === 'student_all_grp');
  return isStudent ? 'Students' : 'Staffs';
};

/**
 * Initialize SAML strategy
 */
export const initializeSamlStrategy = (): void => {
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
      passReqToCallback: true,
    },
    async function (req: any, profile: any, done: any) {
      try {
        const nameID = profile.nameID;
        const username = profile['User.Userrname'];
        const email = profile['User.Email'];
        const firstName = profile['first_name'];
        const lastName = profile['last_name'];
        const department = profile['depart_name']?.toLowerCase() || '';
        const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];

        console.log('=== Extracted Values ===');
        console.log({ nameID, username, email, firstName, lastName, department, groups });

        if (!nameID) {
          return done(new Error('Missing required user information'));
        }

        // Ensure department exists
        if (department) {
          await ensureDepartmentExists(department);
        }

        // Fallback for username if undefined (extract from nameID or email)
        const finalUsername = username || nameID.split('@')[0] || email.split('@')[0];

        const user = await User.findOneAndUpdate(
          { nameID },
          {
            nameID,
            username: finalUsername,
            email,
            firstName,
            lastName,
            department,
            groups: Array.isArray(groups) ? groups : [groups],
            role: mapGroupToRole(Array.isArray(groups) ? groups : [groups]),
            updated: new Date(),
          },
          { upsert: true, new: true }
        );

        const token = jwt.sign(
          { userId: user._id },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        const userData = {
          nameID: user.nameID,
          username: user.username,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          depart_name: user.department,
          groups: user.groups,
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
  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });
};

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

/**
 * Initialize Google Strategy
 */
export const initializeGoogleStrategy = (): void => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://mfulearnai.mfu.ac.th/api/auth/google/callback',
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        console.log('Google Auth Strategy Initialized with callback:', process.env.GOOGLE_CALLBACK_URL || 'https://mfulearnai.mfu.ac.th/api/auth/google/callback');
        try {
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const googleId = profile.id;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Default role mapping based on email domain (optional logic)
          // For now, defaulting to 'Students' if not explicitly defined
          const role = email.endsWith('@mfu.ac.th') ? 'Students' : 'Students';
          const department = 'General'; // Default department

          await ensureDepartmentExists(department);

          // Find or create user
          const user = await User.findOneAndUpdate(
            { email }, // Match by email
            {
              googleId,
              username: email.split('@')[0],
              email,
              firstName,
              lastName,
              department,
              role, // careful with overwriting existing roles
              groups: ['google_user'],
              updated: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          const userData = {
            nameID: user.nameID || googleId,
            username: user.username,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            depart_name: user.department,
            groups: user.groups,
          };

          return done(null, { token, userData });
        } catch (error) {
          console.error('Google Strategy Error:', error);
          return done(error);
        }
      }
    )
  );
};

/**
 * GET /api/auth/login/google - Initiate Google login
 */
export const googleLogin = passport.authenticate('google', {
  scope: ['profile', 'email'],
});

/**
 * GET /api/auth/google/callback - Google callback handler
 */
export const googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  asyncHandler(async (req: any, res: Response): Promise<void> => {
    const { token, userData } = req.user;

    const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');

    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth-callback`);
    redirectUrl.searchParams.append('token', token);
    redirectUrl.searchParams.append('user_data', encodedUserData);

    res.redirect(redirectUrl.toString());
  }),
];

/**
 * GET /api/auth/login/saml - Initiate SAML login
 */
export const samlLogin = passport.authenticate('saml');

/**
 * POST /api/auth/saml/callback - SAML callback handler
 */
export const samlCallback = [
  passport.authenticate('saml', { session: false }),
  asyncHandler(async (req: any, res: Response): Promise<void> => {
    const userData = {
      nameID: req.user.userData.nameID,
      username: req.user.userData.username,
      email: req.user.userData.email,
      firstName: req.user.userData.first_name,
      lastName: req.user.userData.last_name,
      department: req.user.userData.depart_name,
      groups: [mapGroupToRole(req.user.userData.groups || [])],
    };

    // Ensure department exists
    if (userData.department) {
      await ensureDepartmentExists(userData.department);
    }

    const token = jwt.sign(
      {
        nameID: userData.nameID,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        department: userData.department,
        groups: userData.groups,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');

    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth-callback`);
    redirectUrl.searchParams.append('token', token);
    redirectUrl.searchParams.append('user_data', encodedUserData);

    res.redirect(redirectUrl.toString());
  }),
];

/**
 * POST /api/auth/admin/login - Admin login with username/password
 */
export const adminLogin = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new BadRequestError('Please provide username and password');
  }

  const user = await User.findOne({
    username,
    role: { $in: ['Admin', 'SuperAdmin'] }
  });

  if (!user) {
    throw new UnauthorizedError('Account not found');
  }

  const isMatch = await (user as any).comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid password');
  }

  // Ensure department exists
  if (user.department) {
    await ensureDepartmentExists(user.department);
  }

  const token = jwt.sign(
    {
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      role: user.role,
      groups: user.groups,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      role: user.role,
      groups: user.groups,
    },
  });
});

/**
 * POST /api/auth/logout - Logout
 */
export const logout = (req: Request, res: Response): void => {
  req.logout(() => {
    res.status(200).json({ message: 'Logged out successfully' });
  });
};

/**
 * GET /api/auth/logout - Logout redirect
 */
export const logoutRedirect = (req: Request, res: Response): void => {
  req.logout(() => {
    res.redirect(process.env.SAML_IDP_SLO_URL || '/');
  });
};

/**
 * GET /api/auth/logout/saml - SAML logout
 */
export const samlLogout = (req: Request, res: Response): void => {
  req.logout(() => {
    const logoutUrl = process.env.SAML_IDP_SLO_URL || '';
    res.redirect(logoutUrl);
  });
};

/**
 * GET /api/auth/metadata - SAML metadata
 */
export const getMetadata = (req: Request, res: Response): void => {
  // Access the SAML strategy through passport
  const strategy = (passport as any)._strategy('saml') as SamlStrategy;
  if (!strategy) {
    res.status(500).send('SAML strategy not configured');
    return;
  }
  const metadata = strategy.generateServiceProviderMetadata(
    null,
    process.env.SAML_CERTIFICATE
  );
  res.type('application/xml');
  res.send(metadata);
};
