import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
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
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'https://mfulearnai.mfu.ac.th';

// Environment Variables for ADFS
const ADFS_CLIENT_ID = process.env.ADFS_CLIENT_ID;
const ADFS_CLIENT_SECRET = process.env.ADFS_CLIENT_SECRET;
const ADFS_AUTH_URL = process.env.ADFS_AUTH_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/authorize';
const ADFS_TOKEN_URL = process.env.ADFS_TOKEN_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/token';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://mfulearnai.mfu.ac.th/auth/callback';

// Helper to decode JWT (ID Token) without verification (ADFS verified it)
const decodeJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('[OAuth] Failed to decode JWT:', e);
        return null;
    }
};

// --- Passport Setup ---
if (ADFS_CLIENT_ID && ADFS_CLIENT_SECRET) {
    passport.use('adfs', new OAuth2Strategy(
        {
            authorizationURL: ADFS_AUTH_URL,
            tokenURL: ADFS_TOKEN_URL,
            clientID: ADFS_CLIENT_ID,
            clientSecret: ADFS_CLIENT_SECRET,
            callbackURL: REDIRECT_URI,
            // ADFS often requires resource parameter, but standard OAuth2 sends scope.
            // We'll rely on correct scope.
            scope: ['openid', 'profile', 'email']
        },
        async (accessToken: string, refreshToken: string, params: any, profile: any, done: any) => {
            try {
                console.log('[OAuth] ADFS Callback received.');

                // ADFS returns id_token in params
                const idToken = params.id_token;
                if (!idToken) {
                    console.error('[OAuth] No ID Token received from ADFS.');
                    return done(new Error('No ID Token received'));
                }

                const decoded = decodeJwt(idToken);
                console.log('[OAuth] Decoded ID Token Claims:', JSON.stringify(decoded, null, 2));

                if (!decoded) return done(new Error('Invalid ID Token'));

                // Map Claims to User Data
                // Typical MFU ADFS claims: upn (email), unique_name, depart_name, group
                const email = decoded.upn || decoded.email || decoded.unique_name;
                if (!email) return done(new Error('No email found in token'));

                // Domain Check
                const allowedDomains = ['lamduan.mfu.ac.th', 'mfu.ac.th'];
                const domain = email.split('@')[1];

                // Allow staff/students
                if (!allowedDomains.includes(domain) && !email.endsWith('.mfu.ac.th')) {
                    console.warn(`[OAuth] Unauthorized domain: ${domain}`);
                    return done(null, false, { message: 'Unauthorized Domain' });
                }

                // Determine Role
                // ADFS sends "Student" or "Staff" in 'group' claim
                let role = 'student';
                if (decoded.group) {
                    const group = decoded.group.toLowerCase();
                    if (group.includes('staff') || group.includes('employee')) role = 'staff';
                    else if (group.includes('student')) role = 'student';
                } else {
                    // Fallback to domain
                    if (domain === 'mfu.ac.th' || email.includes('staff')) {
                        role = 'staff';
                    }
                }

                // Extract Username (remove MFU\ prefix if present in unique_name)
                let username = email.split('@')[0];
                if (decoded.unique_name && decoded.unique_name.includes('\\')) {
                    username = decoded.unique_name.split('\\')[1];
                }

                const userData = {
                    googleId: decoded.sub || email, // Use email/sub as key
                    email,
                    firstName: decoded.given_name || decoded.firstname || email.split('@')[0],
                    lastName: decoded.family_name || decoded.lastname || '',
                    username,
                    role,
                    department: decoded.depart_name || '', // Map depart_name
                    departId: decoded.depart_id || '', // Map depart_id
                    picture: ''
                };

                // Handshake with Identity Service
                const response = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
                    headers: { 'x-internal-key': INTERNAL_API_KEY }
                });

                const { token, user } = response.data;
                // Pass ADFS idToken to done callback for frontend passing
                return done(null, { token, user, idToken });

            } catch (err: any) {
                console.error('[OAuth] Error in Strategy:', err.message);
                if (axios.isAxiosError(err)) {
                    console.error('[OAuth] Identity Response:', err.response?.data);
                }
                return done(err);
            }
        }
    ));
} else {
    console.warn('[OAuth] ADFS Client ID/Secret missing. ADFS Auth disabled.');
}

// --- Routes ---

app.get('/health', (req: Request, res: Response) => res.json({ status: 'ok', service: 'oauth-service', mode: 'adfs' }));

// Init Login
app.get('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
    if (!ADFS_CLIENT_ID) return res.status(503).json({ error: 'ADFS not configured' });
    passport.authenticate('adfs', {
        session: false,
    })(req, res, next);
});

// Callback Handling
const handleCallback = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('adfs', { session: false, failureRedirect: '/login?error=auth_failed' }, (err: any, user: any, info: any) => {
        if (err || !user) {
            console.error('[OAuth] Auth Failed:', err || info);
            return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
        }

        const { token: authToken, user: userData, idToken } = user;
        const userDataStr = Buffer.from(JSON.stringify(userData)).toString('base64');

        // Redirect to Frontend Callback Handler with id_token
        res.redirect(`${FRONTEND_URL}/auth-callback?token=${authToken}&user_data=${userDataStr}&provider=adfs&id_token=${idToken || ''}`);
    })(req, res, next);
};

// Route for Nginx-proxied callback (https://mfulearnai.mfu.ac.th/auth/callback)
app.get('/auth/callback', handleCallback);

// Legacy/API Route
app.get('/api/auth/callback', handleCallback);

// --- Logout ---
app.get('/api/auth/logout', (req: Request, res: Response) => {
    // Redirect to ADFS Logout
    // ADFS Logout: https://authsso.mfu.ac.th/adfs/oauth2/logout?id_token_hint=...&post_logout_redirect_uri=...
    const idTokenHint = req.query.id_token_hint as string;
    let logoutUrl = `https://authsso.mfu.ac.th/adfs/oauth2/logout?post_logout_redirect_uri=${FRONTEND_URL}/login`;

    if (idTokenHint) {
        logoutUrl += `&id_token_hint=${idTokenHint}`;
    }

    res.redirect(logoutUrl);
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OAuth Service] Running on ${PORT} (Mode: ADFS)`);
});
