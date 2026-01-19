import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import User, { UserDocument, UserRole } from './models/User';
import Department from './models/Department';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Configuration
const PORT = process.env.PORT || 4001; // Internal Default
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mful-auth'; // Same DB as before
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY = process.env.ENV_TYPE === 'PROD' ? '12h' : '24h';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key'; // For Service-to-Service auth

// DB Connection
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('[Identity] Connected to MongoDB');
        try {
            // Fix for Duplicate Key Error: Ensure nameID index is sparse
            // This will drop the existing index if it doesn't match the schema (e.g. was not sparse)
            await User.syncIndexes();
            console.log('[Identity] Indexes synced');
        } catch (idxErr) {
            console.error('[Identity] Index sync error:', idxErr);
        }
    })
    .catch(err => console.error('[Identity] MongoDB error:', err));

// --- Utilities ---

const generateToken = (user: UserDocument) => {
    return jwt.sign({
        userId: user._id,
        role: user.role,
        email: user.email,
        department: user.department,
        permissions: user.permissions,
        environment: process.env.ENV_TYPE
    }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// --- Middleware ---

const authenticateInternal = (req: Request, res: Response, next: any) => {
    const key = req.headers['x-internal-key'];
    if (key !== INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Internal Access Only' });
    }
    next();
};

const authenticateUser = (req: any, res: Response, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// --- ROUTES ---

// 1. Internal Login (Called by SSO/OAuth Services)
// Receives standardized user profile, returns JWT
app.post('/internal/login', authenticateInternal, async (req: Request, res: Response) => {
    const {
        nameID, username, email, firstName, lastName, department, role, groups, googleId
    } = req.body;

    // console.log(`[Identity] Processing internal login for ${email}`);

    try {
        // Find or Update
        const query = nameID ? { nameID } : { email }; // Fallback for Google which might use email as key initially

        // Map groups to role if not explicitly provided (Logic simplified from original)
        let finalRole: UserRole = role || 'student';

        const updateData: any = {
            username: username || email.split('@')[0],
            email,
            firstName,
            lastName,
            isActive: true,
            lastLogin: new Date(),
            $inc: { loginCount: 1 }
        };

        if (department) updateData.department = department;
        if (groups) updateData.groups = groups;
        if (googleId) updateData.googleId = googleId;
        if (nameID) updateData.nameID = nameID;

        // Only update role if it's currently generic 'student' or we are authoritative (SSO usually authoritative)
        // For now, let's respect the passed role
        updateData.role = finalRole;

        // Auto-Create Department if provided
        if (department) {
            // Simple logic: Use department name as code if not provided, or consistent slug
            // For now, assuming department name IS the unique identifier we want to track
            await Department.findOneAndUpdate(
                { code: department },
                { name: department },
                { upsert: true, setDefaultsOnInsert: true }
            );
        }

        const user = await User.findOneAndUpdate(
            query,
            updateData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const token = generateToken(user);

        res.json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                department: user.department,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });

    } catch (e: any) {
        console.error('[Identity] Login error:', e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Admin Login (Direct Username/Password)
app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({
            username,
            role: { $in: ['admin', 'superadmin'] },
            isActive: true
        });

        if (!user || !(await user.comparePassword?.(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user.loginCount = (user.loginCount || 0) + 1;
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user);
        res.json({
            token,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Me (Profile)
app.get('/api/auth/me', authenticateUser, async (req: any, res: Response) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// 4. Refresh Token
app.post('/api/auth/refresh', authenticateUser, async (req: any, res: Response) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

        const token = generateToken(user);
        res.json({ token });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// 5. Create Admin (Superadmin Only)
app.post('/api/users/create-admin', authenticateUser, async (req: any, res: Response) => {
    // Check if requester is Superadmin
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Authorized for Superadmin only' });
    }

    const { username, password, department, firstName, lastName } = req.body;

    if (!username || !password || !department) {
        return res.status(400).json({ error: 'Username, Password, and Department are required' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            role: 'admin',
            department,
            firstName: firstName || 'Admin',
            lastName: lastName || department,
            isActive: true,
            email: `${username}@local.admin` // Dummy email for local admins
        });

        // Ensure department exists
        await Department.findOneAndUpdate(
            { code: department },
            { name: department },
            { upsert: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, user: { id: newUser._id, username: newUser.username } });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 6. List Departments
app.get('/api/departments', authenticateUser, async (req: any, res: Response) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.json({ departments });
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
});

// 7. List Admin Users (Superadmin Only)
app.get('/api/users/admins', authenticateUser, async (req: any, res: Response) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Authorized for Superadmin only' });
    }
    try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
            .select('-password')
            .sort({ role: -1, username: 1 });
        res.json({ admins });
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'identity-service' }));

app.listen(PORT, () => {
    console.log(`[Identity Service] Running on ${PORT}`);
});
