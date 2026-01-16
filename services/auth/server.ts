import express from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import User, { UserDocument } from './models/User';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-auth';
const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Helpers ---

const logActivity = async (level: string, action: string, context: any, userId?: string) => {
    try {
        await axios.post(LOGGER_URL, {
            level,
            service: 'auth-service',
            userId,
            action,
            details: context,
            environment: process.env.ENV_TYPE || 'TEST'
        });
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
};

const mapGroupToRole = (groups: string[]): 'student' | 'staff' => {
    const isStudent = groups.some(group => group === 'student_all_grp');
    return isStudent ? 'student' : 'staff';
};

// --- Passport Strategies ---

// SAML Strategy
passport.use(new SamlStrategy(
    {
        issuer: process.env.SAML_SP_ENTITY_ID,
        callbackUrl: process.env.SAML_SP_ACS_URL,
        entryPoint: process.env.SAML_IDP_SSO_URL || 'https://idp.example.com/sso',
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
            const groupsArray = Array.isArray(groups) ? groups : [groups];

            if (!nameID) return done(new Error('Missing required user information'));

            const finalUsername = username || nameID.split('@')[0] || email?.split('@')[0];

            const user = await User.findOneAndUpdate(
                { nameID },
                {
                    nameID,
                    username: finalUsername,
                    email,
                    firstName,
                    lastName,
                    department,
                    groups: groupsArray,
                    role: mapGroupToRole(groupsArray),
                    updatedAt: new Date(),
                },
                { upsert: true, new: true }
            );

            logActivity('audit', 'saml_login_success', { email: user.email, role: user.role }, user._id.toString());

            const token = jwt.sign({ userId: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
            return done(null, { token, user });
        } catch (error: any) {
            logActivity('error', 'saml_login_failed', { error: error.message });
            return done(error);
        }
    }
));

// Google Strategy
passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_secret',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email found'));

            const user = await User.findOneAndUpdate(
                { email },
                {
                    googleId: profile.id,
                    username: email.split('@')[0],
                    email,
                    firstName: profile.name?.givenName,
                    lastName: profile.name?.familyName,
                    role: 'student',
                    groups: ['google_user'],
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            logActivity('audit', 'google_login_success', { email: user.email, role: user.role }, user._id.toString());

            const token = jwt.sign({ userId: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
            return done(null, { token, user });
        } catch (error: any) {
            logActivity('error', 'google_login_failed', { error: error.message });
            return done(error);
        }
    }
));

// --- Routes ---

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// SAML
app.get('/api/auth/login/saml', passport.authenticate('saml'));
app.post('/api/auth/saml/callback',
    passport.authenticate('saml', { session: false }),
    (req: any, res) => {
        const { token, user } = req.user;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth-callback?token=${token}`);
    }
);

// Google
app.get('/api/auth/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req: any, res) => {
        const { token, user } = req.user;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth-callback?token=${token}`);
    }
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
