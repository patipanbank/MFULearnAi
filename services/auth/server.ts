import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import axios from 'axios';
import User, { UserDocument } from './models/User';
import { UserRole } from '../../shared/types';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

// Environment Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-auth';
const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST'; // 'TEST' (MFULearnAI) or 'PROD' (DinDinAI)

// JWT expiry: shorter for production
const JWT_EXPIRY = ENV_TYPE === 'PROD' ? '12h' : '24h';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log(`[Auth Service] Connected to MongoDB (${ENV_TYPE})`))
    .catch(err => console.error('[Auth Service] MongoDB connection error:', err));

// --- Audit Logger ---
const logActivity = async (
    level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
    action: string,
    context: any,
    userId?: string,
    req?: Request
) => {
    try {
        await axios.post(LOGGER_URL, {
            level,
            service: 'auth-service',
            userId,
            action,
            details: {
                ...context,
                ipAddress: req?.ip || req?.headers['x-forwarded-for'] || 'unknown',
                userAgent: req?.headers['user-agent'] || 'unknown'
            },
            environment: ENV_TYPE,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Auth Service] Failed to log activity:', err);
    }
};

// --- Role Mapping ---
const mapGroupToRole = (groups: string[]): UserRole => {
    // Check for admin groups first
    if (groups.some(g => g.includes('admin') || g.includes('superadmin'))) {
        return groups.some(g => g.includes('superadmin')) ? 'superadmin' : 'admin';
    }
    // Check for staff
    if (groups.some(g => g.includes('staff') || !g.includes('student'))) {
        return 'staff';
    }
    // Default to student
    return 'student';
};

// --- Update Login Stats ---
const updateLoginStats = async (user: UserDocument) => {
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();
};

// --- Passport Strategies ---

// SAML Strategy for MFU SSO
passport.use(new SamlStrategy(
    {
        issuer: process.env.SAML_SP_ENTITY_ID || 'mfu-learn-ai',
        callbackUrl: process.env.SAML_SP_ACS_URL || `${FRONTEND_URL}/api/auth/saml/callback`,
        entryPoint: process.env.SAML_IDP_SSO_URL || 'https://idp.mfu.ac.th/sso',
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
            // FIXED: Changed from 'User.Userrname' to 'User.Username'
            const username = profile['User.Username'] || profile['User.Userrname']; // Backwards compatible
            const email = profile['User.Email'];
            const firstName = profile['first_name'];
            const lastName = profile['last_name'];
            const department = profile['depart_name']?.toLowerCase() || '';
            const groups = profile['http://schemas.xmlsoap.org/claims/Group'] || [];
            const groupsArray = Array.isArray(groups) ? groups : [groups];

            if (!nameID) {
                logActivity('error', 'saml_login_failed', { reason: 'Missing nameID' }, undefined, req);
                return done(new Error('Missing required user information'));
            }

            const finalUsername = username || nameID.split('@')[0] || email?.split('@')[0];
            const role = mapGroupToRole(groupsArray);

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
                    role,
                    isActive: true,
                    permissions: [], // Default empty, can be set by admin
                },
                { upsert: true, new: true }
            );

            await updateLoginStats(user);
            logActivity('audit', 'saml_login_success', {
                email: user.email,
                role: user.role,
                department: user.department
            }, user._id.toString(), req);

            const token = jwt.sign({
                userId: user._id,
                role: user.role,
                email: user.email,
                permissions: user.permissions,
                environment: ENV_TYPE
            }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

            return done(null, { token, user });
        } catch (error: any) {
            logActivity('error', 'saml_login_failed', { error: error.message }, undefined, req);
            return done(error);
        }
    }
));

// Google Strategy (fallback for testing)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) return done(new Error('No email found'));

                // Determine role based on email domain
                let role: UserRole = 'student';
                if (email.endsWith('@mfu.ac.th')) {
                    role = email.includes('staff') ? 'staff' : 'student';
                }

                const user = await User.findOneAndUpdate(
                    { email },
                    {
                        googleId: profile.id,
                        nameID: profile.id, // Use Google ID as nameID
                        username: email.split('@')[0],
                        email,
                        firstName: profile.name?.givenName,
                        lastName: profile.name?.familyName,
                        role,
                        groups: ['google_user'],
                        isActive: true,
                        permissions: [],
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                await updateLoginStats(user);
                logActivity('audit', 'google_login_success', { email: user.email, role: user.role }, user._id.toString());

                const token = jwt.sign({
                    userId: user._id,
                    role: user.role,
                    email: user.email,
                    permissions: user.permissions,
                    environment: ENV_TYPE
                }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

                return done(null, { token, user });
            } catch (error: any) {
                logActivity('error', 'google_login_failed', { error: error.message });
                return done(error);
            }
        }
    ));
}

// --- Middleware ---
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
};

const requireRole = (...roles: UserRole[]) => {
    return (req: any, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// --- Routes ---

// Health Check
app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'auth-service',
    environment: ENV_TYPE
}));

// SAML Routes
app.get('/api/auth/login/saml', passport.authenticate('saml'));

app.post('/api/auth/saml/callback',
    passport.authenticate('saml', { session: false }),
    (req: any, res) => {
        const { token, user } = req.user;
        const userData = Buffer.from(JSON.stringify({
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            department: user.department
        })).toString('base64');

        res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&user_data=${userData}`);
    }
);

// Google Routes (if configured)
if (process.env.GOOGLE_CLIENT_ID) {
    app.get('/api/auth/login/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

    app.get('/api/auth/google/callback',
        passport.authenticate('google', { session: false, failureRedirect: '/login' }),
        (req: any, res) => {
            const { token, user } = req.user;
            const userData = Buffer.from(JSON.stringify({
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            })).toString('base64');

            res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&user_data=${userData}`);
        }
    );
}

// Admin Login (username/password)
app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({
            username,
            role: { $in: ['admin', 'superadmin'] },
            isActive: true
        });

        if (!user) {
            logActivity('warn', 'admin_login_failed', { username, reason: 'User not found' }, undefined, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await user.comparePassword?.(password);
        if (!isValid) {
            logActivity('warn', 'admin_login_failed', { username, reason: 'Invalid password' }, user._id.toString(), req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await updateLoginStats(user);
        logActivity('audit', 'admin_login_success', { username, role: user.role }, user._id.toString(), req);

        const token = jwt.sign({
            userId: user._id,
            role: user.role,
            email: user.email,
            permissions: user.permissions,
            environment: ENV_TYPE
        }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        res.json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                permissions: user.permissions
            }
        });
    } catch (error: any) {
        logActivity('error', 'admin_login_error', { error: error.message }, undefined, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Token Refresh
app.post('/api/auth/refresh', authenticateToken, async (req: any, res: Response) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        const token = jwt.sign({
            userId: user._id,
            role: user.role,
            email: user.email,
            permissions: user.permissions,
            environment: ENV_TYPE
        }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

        logActivity('info', 'token_refreshed', { userId: user._id.toString() }, user._id.toString(), req);
        res.json({ token });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, async (req: any, res: Response) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout (client-side token removal, but log the event)
app.post('/api/auth/logout', authenticateToken, async (req: any, res: Response) => {
    logActivity('audit', 'logout', { userId: req.user.userId }, req.user.userId, req);
    res.json({ success: true, message: 'Logged out successfully' });
});

// --- Admin Routes ---

// List Users (admin only)
app.get('/api/auth/users', authenticateToken, requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments();

        res.json({ users, total, page, limit });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update User Role (superadmin only)
app.patch('/api/auth/users/:userId/role', authenticateToken, requireRole('superadmin'), async (req: any, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['student', 'staff', 'admin', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        logActivity('audit', 'user_role_updated', {
            targetUserId: userId,
            newRole: role
        }, req.user.userId, req);

        res.json({ user });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create Admin User (superadmin only)
app.post('/api/auth/users/admin', authenticateToken, requireRole('superadmin'), async (req: any, res: Response) => {
    try {
        const { username, email, password, firstName, lastName, role } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password required' });
        }

        if (!['admin', 'superadmin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or superadmin' });
        }

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            nameID: `admin-${username}`,
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
            groups: ['admin'],
            isActive: true,
            permissions: [],
            loginCount: 0
        });

        await user.save();

        logActivity('audit', 'admin_user_created', {
            newUsername: username,
            newRole: role
        }, req.user.userId, req);

        res.status(201).json({
            message: 'Admin user created',
            user: {
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`[Auth Service] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
