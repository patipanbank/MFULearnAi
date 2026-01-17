import express from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(passport.initialize());

const PORT = process.env.PORT || 4002;
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:4001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';

// --- Helper: Map Role ---
const mapGroupsToRole = (groups: any) => {
    const g = Array.isArray(groups) ? groups : [groups];
    if (g.some((x: string) => x && (x.includes('superadmin')))) return 'superadmin';
    if (g.some((x: string) => x && (x.includes('admin')))) return 'admin';
    if (g.some((x: string) => x && (x.includes('staff')))) return 'staff';
    return 'student'; // Default
};

// --- Passport Setup ---
passport.use(new SamlStrategy(
    {
        issuer: process.env.SAML_SP_ENTITY_ID || 'mfu-learn-ai',
        callbackUrl: process.env.SAML_SP_ACS_URL || `${process.env.API_GATEWAY_URL || 'http://localhost:6000'}/api/auth/saml/callback`,
        entryPoint: process.env.SAML_IDP_SSO_URL || 'https://idp.mfu.ac.th/sso', // Mock/Real URL
        logoutUrl: process.env.SAML_IDP_SLO_URL || '',
        cert: process.env.SAML_CERTIFICATE || '',
        disableRequestedAuthnContext: true,
        forceAuthn: false,
        identifierFormat: null,
        wantAssertionsSigned: true,
        acceptedClockSkewMs: -1,
        validateInResponseTo: false,
        passReqToCallback: true
    },
    async (req: any, profile: any, done: any) => {
        try {
            // Transform SAML Profile to Standard User Object
            const nameID = profile.nameID;
            const username = profile['User.Userrname'] || profile['User.Username'] || nameID;
            const email = profile['User.Email'] || profile.email;
            const firstName = profile['first_name'] || profile.givenName;
            const lastName = profile['last_name'] || profile.sn;
            const department = profile['depart_name'] || 'General';
            const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];

            const userData = {
                nameID,
                username,
                email,
                firstName,
                lastName,
                department,
                groups,
                role: mapGroupsToRole(groups)
            };

            // Call Identity Service to Login/Create User and Get Token
            // console.log('[SSO] Calling Identity Service with:', userData.email);

            const response = await axios.post(`${IDENTITY_SERVICE_URL}/internal/login`, userData, {
                headers: { 'x-internal-key': INTERNAL_API_KEY }
            });

            const { token, user } = response.data;
            return done(null, { token, user });

        } catch (err: any) {
            console.error('[SSO] Identity Handshake Failed:', err.message);
            return done(err);
        }
    }
));

// --- Routes ---

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'sso-service' }));

// Init Login
app.get('/api/auth/login/saml', passport.authenticate('saml', { failureRedirect: '/login?error=saml_init_failed' }));

// Callback
app.post('/api/auth/saml/callback',
    passport.authenticate('saml', { session: false, failureRedirect: '/login?error=saml_auth_failed' }),
    (req: any, res) => {
        const { token, user } = req.user;

        // Encode user data for frontend
        const userDataStr = Buffer.from(JSON.stringify(user)).toString('base64');

        // Redirect to Frontend
        res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&user_data=${userDataStr}`);
    }
);

// Logout (SLO)
app.get('/api/auth/logout', (req, res) => {
    const logoutUrl = process.env.SAML_IDP_SLO_URL;
    if (logoutUrl) {
        res.redirect(logoutUrl);
    } else {
        res.status(200).json({ message: 'Logged out (Local only, no SLO URL configured)' });
    }
});

app.listen(PORT, () => {
    console.log(`[SSO Service] Running on ${PORT}`);
});
