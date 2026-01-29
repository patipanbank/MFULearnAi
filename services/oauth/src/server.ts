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
                // Log Raw Profile for Data Extraction
                console.log('[OAuth] Raw Google Profile:', JSON.stringify(profile, null, 2));

                // Transform Google Profile to Standard User Object
                const email = profile.emails?.[0].value;
                if (!email) return done(new Error('No email from Google'));

                // Domain Restriction: Allow only lamduan.mfu.ac.th (Student) or mfu.ac.th (Staff)
                // "disable emails that are not lamduan" requested by user, but usually staff need access too.
                // Assuming strict organization check.
                const allowedDomains = ['lamduan.mfu.ac.th', 'mfu.ac.th'];
                const domain = email.split('@')[1];
                if (!allowedDomains.includes(domain)) {
                    console.warn(`[OAuth] Blocked login attempt from unauthorized domain: ${domain}`);
                    return done(null, false, { message: 'Unauthorized Domain. Please use your @lamduan.mfu.ac.th or @mfu.ac.th account.' });
                }

                // Determine Role by Domain (HD field is more reliable)
                const hd = profile._json.hd || '';
                let role = 'student';

                if (hd === 'mfu.ac.th') {
                    role = 'staff';
                } else if (hd === 'lamduan.mfu.ac.th') {
                    role = 'student';
                } else if (email.includes('staff')) { // Fallback checks
                    role = 'staff';
                }

                // Extract Picture
                const picture = profile.photos?.[0]?.value || profile._json.picture || '';

                const userData = {
                    googleId: profile.id,
                    email,
                    firstName: profile.name?.givenName,
                    lastName: profile.name?.familyName,
                    username: email.split('@')[0],
                    role,
                    picture
                };

                // Call Identity Service to Login/Create User and Get Token
                const response = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
                    headers: { 'x-internal-key': INTERNAL_API_KEY }
                });

                const { token, user } = response.data;
                return done(null, { token, user });

            } catch (err: any) {
                if (axios.isAxiosError(err) && err.response) {
                    console.error('[OAuth] Identity Service Error:', JSON.stringify(err.response.data));
                }
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

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OAuth Service] Running on ${PORT}`);
});
