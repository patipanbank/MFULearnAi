
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { UserDocument, UserRole } from '../models/User';
import Department from '../models/Department';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRY = process.env.ENV_TYPE === 'PROD' ? '12h' : '24h';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';

export class AuthService {
    /**
     * Generate JWT Token for a user
     */
    static generateToken(user: UserDocument): string {
        return jwt.sign({
            userId: user._id,
            role: user.role,
            email: user.email,
            department: user.department,
            departmentId: user.departmentId,
            permissions: user.permissions,
            environment: process.env.ENV_TYPE
        }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    }

    /**
     * Middleware to authenticate internal service calls
     */
    static authenticateInternal(req: Request, res: Response, next: NextFunction) {
        const key = req.headers['x-internal-key'];
        if (key !== INTERNAL_API_KEY) {
            return res.status(403).json({ error: 'Forbidden: Internal Access Only' });
        }
        next();
    }

    /**
     * Middleware to authenticate users via JWT
     * Supports Authorization header and query param 'token'
     */
    static authenticateUser(req: Request, res: Response, next: NextFunction) {
        // 1. Capture/Propagate Correlation ID
        const correlationId = (req.headers['x-correlation-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // @ts-ignore - correlationId extension
        req.correlationId = correlationId;
        res.setHeader('x-correlation-id', correlationId);

        // 2. Extract Token
        let token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
        // Fallback: Check query param (for <img> tags, downloads, or SSE)
        if (!token && req.query && req.query.token) {
            token = req.query.token as string;
        }

        if (!token) return res.status(401).json({ error: 'No token' });

        jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });
            // @ts-ignore - user extension
            req.user = decoded;
            next();
        });
    }

    /**
     * Middleware guard for Role-based access
     */
    static requireRole(roles: UserRole[]) {
        return (req: Request, res: Response, next: NextFunction) => {
            // @ts-ignore
            if (!req.user || !roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            next();
        };
    }

    /**
     * Internal Login Logic (Shared by SSO/OAuth)
     */
    static async handleInternalLogin(profile: any) {
        const {
            nameID, username, email, firstName, lastName, department, departmentId, role, groups, googleId, picture
        } = profile;

        // Find or Update
        const query = nameID ? { nameID } : { email };

        let finalRole: UserRole = role || 'student';

        let user = await User.findOne(query);

        if (user && user.isActive === false) {
            throw new Error('Account is disabled');
        }

        const updateData: any = {
            username: username || email.split('@')[0],
            email,
            firstName,
            lastName,
            lastLogin: new Date(),
            $inc: { loginCount: 1 }
        };

        if (department) updateData.department = department;
        if (departmentId) updateData.departmentId = departmentId;
        if (groups) updateData.groups = groups;
        if (googleId) updateData.googleId = googleId;
        if (nameID) updateData.nameID = nameID;
        if (picture) updateData.picture = picture;

        if (!user) {
            updateData.role = finalRole;
            updateData.isActive = true;
        }

        // Auto-Create Department
        if (department) {
            const deptCode = departmentId || department.trim().toUpperCase().replace(/\s+/g, '_');
            await Department.findOneAndUpdate(
                { code: deptCode },
                { code: deptCode, name: department },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch(err => console.error(`[Auth] Department sync error: ${err.message}`));
        }

        user = await User.findOneAndUpdate(
            query,
            updateData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (!user) throw new Error('Failed to create/update user');

        return {
            token: this.generateToken(user),
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                department: user.department,
                departmentId: user.departmentId,
                firstName: user.firstName,
                lastName: user.lastName,
                picture: user.picture
            }
        };
    }
}
