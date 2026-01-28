import express from 'express';
import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import jwt from 'jsonwebtoken';
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

// --- Configuration ---
const MFU_CLIENT_ID = process.env.MFU_CLIENT_ID || '382dab5a-4844-407d-8f91-a0ae6d26e5d0';
const MFU_CLIENT_SECRET = process.env.MFU_CLIENT_SECRET || 'Y97QMKvWqanojhOsQUzUrpDK37fUtrTzlPDw83Oo';
// Note: Redirect URI must match ADFS registration exactly.
const MFU_CALLBACK_URL = process.env.MFU_CALLBACK_URL || 'https://mfulearnai.mfu.ac.th/auth/callback';
const MFU_AUTH_URL = process.env.MFU_AUTH_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/authorize';
const MFU_TOKEN_URL = process.env.MFU_TOKEN_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/token';
const MFU_LOGOUT_URL = process.env.MFU_LOGOUT_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/logout';

// --- Passport Setup ---
const strategy = new OAuth2Strategy(
    {
        authorizationURL: MFU_AUTH_URL,
        tokenURL: MFU_TOKEN_URL,
        clientID: MFU_CLIENT_ID,
        clientSecret: MFU_CLIENT_SECRET,
        callbackURL: MFU_CALLBACK_URL,
        scope: ['openid', 'profile', 'email']
    },
    async (accessToken: string, refreshToken: string, params: any, profile: any, done: any) => {
        try {
            // console.log('[OAuth] MFU Access Token:', accessToken);
            // console.log('[OAuth] MFU Params:', params);

            // 1. Decode ID Token to get User Info (ADFS OIDC)
            const idToken = params.id_token;
            if (!idToken) {
                return done(new Error('No id_token received from ADFS'));
            }

            const decoded: any = jwt.decode(idToken);
            console.log('[OAuth] MFU ID Token Decoded:', JSON.stringify(decoded, null, 2));

            if (!decoded) {
                return done(new Error('Failed to decode id_token'));
            }

            // 2. Extract User Info
            // Mapping depends on ADFS claim names. Common OIDC claims: sub, email, upn, unique_name, given_name, family_name, etc.
            // Adjust based on observation or standard MFU claims.
            const email = decoded.email || decoded.upn || decoded.unique_name;
            if (!email) {
                console.error('[OAuth] Error: No email in token');
                return done(new Error('No email found in id_token'));
            }

            // 3. Determine Role
            let role = 'student';
            if (email.endsWith('@mfu.ac.th')) {
                role = 'staff';
            } else if (email.endsWith('@lamduan.mfu.ac.th')) {
                role = 'student';
            }

            // 3.1 Extract Department
            const department = decoded.depart_name || decoded.depart_id || '';

            // 4. Prepare User Data for Identity Service
            const userData = {
                googleId: decoded.sub,
                email,
                firstName: decoded.given_name || decoded.first_name || '',
                lastName: decoded.family_name || decoded.last_name || '',
                username: email.split('@')[0],
                department,
                role,
                picture: ''
            };

            console.log('[OAuth] Sending to Identity:', JSON.stringify(userData, null, 2));

            // 5. Login/Create in Identity Service
            try {
                const response = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
                    headers: { 'x-internal-key': INTERNAL_API_KEY },
                    timeout: 5000
                });

                const { token, user } = response.data;
                console.log('[OAuth] Identity Response OK');

                // Pass id_token to callback for logout hint
                return done(null, { token, user, id_token: idToken });
            } catch (axiosErr: any) {
                console.error('[OAuth] Identity Service Call Failed:', axiosErr.message);
                if (axiosErr.response) {
                    console.error('[OAuth] Identity Response Status:', axiosErr.response.status);
                    console.error('[OAuth] Identity Response Data:', JSON.stringify(axiosErr.response.data));
                }
                throw axiosErr;
            }

        } catch (err: any) {
            console.error('[OAuth] MFU Auth Critical Error:', err);
            console.error('[OAuth] Stack:', err.stack);
            return done(err);
        }
    }
);

// FORCE: Send client_id/secret in Body instead of Basic Auth Header (Fix for ADFS MSIS9612/InvalidGrant)
const oauth2: any = strategy;
// Workaround: The explicit method might be missing or named differently in some versions.
// Direct property assignment is safer for the underlying node-oauth lib.
if (oauth2._oauth2) {
    oauth2._oauth2._useAuthorizationHeaderForCredentials = false;
}

passport.use('mfu', strategy);

// --- Routes ---

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'oauth-service' }));

// 1. Init Login
app.get('/api/auth/login/mfu', (req, res, next) => {
    passport.authenticate('mfu', {
        session: false
    })(req, res, next);
});

// 2. Callback
app.get(['/api/auth/mfu/callback', '/auth/callback'],
    passport.authenticate('mfu', { session: false, failureRedirect: '/login?error=mfu_auth_failed' }),
    (req: any, res) => {
        const { token, user, id_token } = req.user;

        // Redirect to Frontend with Token ONLY (User data fetched by frontend)
        res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&provider=mfu&id_token=${id_token}`);
    }
);

// 3. Logout
app.get('/api/auth/logout', (req: any, res) => {
    const idToken = req.query.id_token_hint;
    const postLogoutRedirect = `${FRONTEND_URL}/login`; // or a specific logout callback

    let logoutUrl = MFU_LOGOUT_URL;
    if (idToken) {
        logoutUrl += `?id_token_hint=${idToken}&post_logout_redirect_uri=${postLogoutRedirect}`;
    }

    res.redirect(logoutUrl);
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
    console.error('[OAuth] Uncaught Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OAuth Service] CONFIG:
    - MFU_CALLBACK_URL: ${MFU_CALLBACK_URL}
    - MFU_CLIENT_ID: ${MFU_CLIENT_ID.substring(0, 5)}...
    - MFU_AUTH_URL: ${MFU_AUTH_URL}
    `);
    console.log(`[OAuth Service] Running on ${PORT}`);
});
