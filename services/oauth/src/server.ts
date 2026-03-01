import express from 'express';
// passport is no longer used for the main flow, but keeping structure similar for minimal friction
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4003;
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:4001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Fallback
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || (ENV_TYPE === 'PROD' ? '' : 'internal-secret-key');

if (ENV_TYPE === 'PROD' && !INTERNAL_API_KEY) {
    console.error('[FATAL] INTERNAL_API_KEY is required in PROD environment');
    process.exit(1);
}

// --- MFU SSO Configuration ---
const MFU_CLIENT_ID = process.env.MFU_SSO_CLIENT_ID || '382dab5a-4844-407d-8f91-a0ae6d26e5d0';
const MFU_CLIENT_SECRET = process.env.MFU_SSO_CLIENT_SECRET || 'Y97QMKvWqanojhOsQUzUrpDK37fUtrTzlPDw83Oo';
const MFU_AUTH_URL = process.env.MFU_SSO_AUTH_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/authorize';
const MFU_TOKEN_URL = process.env.MFU_SSO_TOKEN_URL || 'https://authsso.mfu.ac.th/adfs/oauth2/token';
// Logout URL pattern: https://authsso.mfu.ac.th/adfs/oauth2/logout?id_token_hint={{adfsIdToken}}&post_logout_redirect_uri={{RedirectUri}}

// --- Helper Functions ---

// Simple JWT Body Decoder (without verification - we trust the TLS channel from ADFS)
function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to parse JWT:', e);
        return null;
    }
}

// --- Routes ---

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'oauth-service', mode: 'MFU-SSO' }));

// 1. Redirect to MFU SSO
app.get('/api/auth/login/sso', (req, res) => {
    // Determine redirect URI based on host/origin if possible, or hardcode known ones
    const host = req.get('host') || '';

    // Default to mfulearnai
    let redirectBase = 'https://mfulearnai.mfu.ac.th';
    if (host.includes('dindinai')) {
        redirectBase = 'https://dindinai.mfu.ac.th';
    }

    const redirectUri = `${redirectBase}/auth/callback`;

    // Construct Authorization URL
    // Scope: openid email profile (standard ADFS scopes needed for ID Token)
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: MFU_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: 'openid email profile'
    });

    const authUrl = `${MFU_AUTH_URL}?${params.toString()}`;

    console.log(`[OAuth] Redirecting to SSO: ${authUrl}`);
    res.redirect(authUrl);
});

// 2. Callback Processing (Called by Frontend with code)
app.post('/api/auth/sso/callback', async (req, res) => {
    try {
        const { code, redirect_uri } = req.body;

        if (!code || !redirect_uri) {
            return res.status(400).json({ error: 'Missing code or redirect_uri' });
        }

        console.log(`[OAuth] Exchanging code for token. RedirectURI: ${redirect_uri}`);

        // Exchange Code for Token
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('client_id', MFU_CLIENT_ID);
        tokenParams.append('client_secret', MFU_CLIENT_SECRET);
        tokenParams.append('redirect_uri', redirect_uri);
        tokenParams.append('code', code);

        const tokenResponse = await axios.post(MFU_TOKEN_URL, tokenParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, id_token } = tokenResponse.data;

        if (!id_token) {
            throw new Error('No id_token received from SSO');
        }

        // Decode ID Token to get User Info
        const profile = parseJwt(id_token);
        console.log('[OAuth] SSO Profile:', JSON.stringify(profile, null, 2));

        if (!profile) {
            throw new Error('Failed to decode id_token');
        }

        // Map MFU Profile to Internal User Schema
        const userData = {
            googleId: profile.sub || profile.upn, // Use sub or upn as unique ID
            email: profile.email || profile.upn,
            firstName: profile.given_name,
            lastName: profile.family_name,
            username: profile.username || (profile.email ? profile.email.split('@')[0] : 'unknown'),
            role: 'student', // Default
            department: profile.depart_name, // Map MFU 'depart_name' to 'department'
            departmentId: profile.depart_id, // New field from MFU SSO
            departName: profile.depart_name, // Keep for backward compat if needed
            provider: 'sso'
        };

        // Role Mapping Logic
        if (profile.group === 'Staff' || profile.group === 'Lecturer') { // Adjust based on actual 'group' values
            userData.role = 'staff';
        }
        // Fallback or explicit check from original logic
        if (profile.email && profile.email.includes('@mfu.ac.th') && !profile.email.includes('lamduan')) {
            userData.role = 'staff';
        }

        // Call Identity Service to Login/Create User
        const identityResponse = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
            headers: { 'x-internal-key': INTERNAL_API_KEY }
        });

        const { token: platformToken, user: platformUser } = identityResponse.data;

        // Return Data to Frontend
        res.json({
            token: platformToken,
            user: platformUser,
            sso_id_token: id_token // Optional: Return if needed for logout hint
        });

    } catch (err: any) {
        console.error('[OAuth] SSO Exchange Failed:', err.message);
        if (axios.isAxiosError(err) && err.response) {
            console.error('[OAuth] Details:', JSON.stringify(err.response.data));
        }
        res.status(401).json({ error: 'Authentication failed' });
    }
});


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[OAuth Service] Running on ${PORT} (MFU SSO Mode)`);
});
