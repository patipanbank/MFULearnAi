import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

const PORT = process.env.PORT || 4003;
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:4001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:6000';

// --- Passport Setup ---
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || `${API_GATEWAY_URL}/api/auth/google/callback`,
            scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Transform Google Profile to Standard User Object
                const email = profile.emails?.[0].value;
                if (!email) return done(new Error('No email from Google'));

                const userData = {
                    googleId: profile.id,
                    email,
                    firstName: profile.name?.givenName,
                    lastName: profile.name?.familyName,
                    username: email.split('@')[0],
                    // Determine Role by Domain
                    role: email.endsWith('@mfu.ac.th') && email.includes('staff') ? 'staff' : 'student'
                };

                // Call Identity Service to Login/Create User and Get Token
                const response = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
                    headers: { 'x-internal-key': INTERNAL_API_KEY }
                });

                const { token, user } = response.data;
                return done(null, { token, user });

            } catch (err: any) {
                console.error('[OAuth] Identity Handshake Failed:', err.message);
                return done(err);
            }
        }
    ));
} else {
    console.warn('[OAuth] Google Client ID/Secret missing. Google Auth disabled.');
}

// --- Routes ---

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'oauth-service' }));

// Init Login
app.get('/api/auth/login/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google Auth not configured' });
    passport.authenticate('google', {
        session: false,
        prompt: 'select_account'
    })(req, res, next);
});

// Callback
app.get('/api/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_auth_failed' }),
    (req: any, res) => {
        const { token, user } = req.user;

        // Encode user data for frontend
        const userDataStr = Buffer.from(JSON.stringify(user)).toString('base64');

        // Redirect to Frontend
        res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&user_data=${userDataStr}&provider=google`);
    }
);

app.listen(PORT, () => {
    console.log(`[OAuth Service] Running on ${PORT}`);
});
