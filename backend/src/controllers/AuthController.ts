
import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AuthService } from '../auth/AuthService';
import { OAuthService } from '../auth/OAuthService';
import User from '../models/User';
import Department from '../models/Department';
import bcrypt from 'bcryptjs';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export class AuthController {

    // --- Admin Login ---
    static async loginAdmin(req: Request, res: Response) {
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

            const token = AuthService.generateToken(user);
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
    }

    // --- SAML (SSO) ---
    static startSamlLogin = passport.authenticate('saml', { failureRedirect: '/login?error=saml_init_failed' });

    static handleSamlCallback(req: Request, res: Response, next: NextFunction) {
        passport.authenticate('saml', { session: false, failureRedirect: '/login?error=saml_auth_failed' },
            (err: any, authResult: any) => {
                if (err || !authResult) {
                    return res.redirect(`${FRONTEND_URL}/login?error=saml_callback_failed`);
                }
                const { token, user } = authResult;
                const userDataStr = Buffer.from(JSON.stringify(user)).toString('base64');
                res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}&user_data=${userDataStr}&provider=sso`);
            }
        )(req, res, next);
    }

    // --- MFU SSO (OAuth) ---
    static startSsoLogin(req: Request, res: Response) {
        const host = req.get('host') || '';
        // Use service to generate consistent redirect URI (Frontend Callback)
        const redirectUri = OAuthService.getRedirectUrl(host);

        const authUrl = OAuthService.getAuthUrl(redirectUri);
        res.redirect(authUrl);
    }

    static async handleSsoCallback(req: Request, res: Response) {
        try {
            const { code, redirect_uri } = req.body;
            if (!code || !redirect_uri) return res.status(400).json({ error: 'Missing code or redirect_uri' });

            const authResult = await OAuthService.handleCallback(code, redirect_uri);
            res.json(authResult);
        } catch (err: any) {
            console.error('[Auth] SSO Callback Error:', err.message);
            res.status(401).json({ error: 'Authentication failed' });
        }
    }

    // --- User Info & Refresh ---
    static async me(req: any, res: Response) {
        try {
            const user = await User.findById(req.user.userId).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({ user });
        } catch (e) {
            res.status(500).json({ error: 'Server Error' });
        }
    }

    static logout(req: Request, res: Response, next: NextFunction) {
        req.logout?.((err) => {
            if (err) { return next(err); }
            res.json({ success: true, message: 'Logged out' });
        });
        if (!req.logout) {
            res.json({ success: true, message: 'Logged out' });
        }
    }

    static async refresh(req: any, res: Response) {
        // Logic handled in middleware or here with ignoreExpiration
        // Currently relying on client to call this endpoint with expired token
        // Need custom logic since authentication middleware rejects expired tokens usually?
        // For refresh, we usually parse without verification or with ignoreExpiration
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        const jwt = require('jsonwebtoken'); // Lazy load
        const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

        jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, async (err: any, decoded: any) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });

            const user = await User.findById(decoded.userId);
            if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

            const newToken = AuthService.generateToken(user);
            res.json({ token: newToken });
        });
    }

    // --- User Management (Admin) ---
    static async listUsers(req: any, res: Response) {
        try {
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            res.json({ users });
        } catch (e) {
            res.status(500).json({ error: 'Failed' });
        }
    }

    static async createUser(req: any, res: Response) {
        try {
            const { username, password, role, department, firstName, lastName, isActive } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Required fields missing' });

            if (await User.findOne({ username })) return res.status(400).json({ error: 'Username exists' });

            const hashedPassword = await bcrypt.hash(password, 10);

            // Dept ID logic
            let departmentId = '';
            if (department) {
                const existingDept = await Department.findOne({ name: department });
                departmentId = existingDept ? existingDept.code : department.trim().toUpperCase().replace(/\s+/g, '_');

                await Department.findOneAndUpdate(
                    { code: departmentId }, { code: departmentId, name: department },
                    { upsert: true, setDefaultsOnInsert: true }
                );
            }

            const newUser = await User.create({
                username, password: hashedPassword, role: role || 'student',
                department, departmentId, firstName, lastName, isActive: isActive ?? true,
                email: req.body.email || `${username}@local.domain`
            });

            res.json({ user: newUser });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async updateUser(req: any, res: Response) {
        try {
            const { role, department, isActive, firstName, lastName } = req.body;
            const updateData: any = {};
            if (role) updateData.role = role;
            if (typeof isActive === 'boolean') updateData.isActive = isActive;
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;

            if (department) {
                updateData.department = department;
                const existingDept = await Department.findOne({ name: department });
                updateData.departmentId = existingDept ? existingDept.code : department.trim().toUpperCase().replace(/\s+/g, '_');

                await Department.findOneAndUpdate(
                    { code: updateData.departmentId }, { code: updateData.departmentId, name: department },
                    { upsert: true, setDefaultsOnInsert: true }
                );
            }

            const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
            res.json({ user });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async deleteUser(req: any, res: Response) {
        try {
            await User.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    // --- Departments ---
    static async listDepartments(req: any, res: Response) {
        try {
            const departments = await Department.find().sort({ name: 1 });
            res.json({ departments });
        } catch (e: any) {
            res.status(500).json({ error: 'Failed' });
        }
    }

    static async createDepartment(req: any, res: Response) {
        try {
            const { code, name } = req.body;
            if (!name) return res.status(400).json({ error: 'Name required' });
            const deptCode = code || name.trim().toUpperCase().replace(/\s+/g, '_');
            const newDept = await Department.create({ code: deptCode, name: name.trim() });
            res.json({ department: newDept });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async updateDepartment(req: any, res: Response) {
        try {
            const { name } = req.body;
            const dept = await Department.findByIdAndUpdate(req.params.id, { name: name.trim() }, { new: true });
            res.json({ department: dept });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async deleteDepartment(req: any, res: Response) {
        try {
            await Department.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
}
