
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { UserDocument, UserRole } from '../models/User';
import Department from '../models/Department';
import ApiKey from '../models/ApiKey';
import crypto from 'crypto';

const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const JWT_SECRET = process.env.JWT_SECRET || (ENV_TYPE === 'PROD' ? '' : 'dev-secret');
const JWT_EXPIRY = ENV_TYPE === 'PROD' ? '12h' : '24h';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || (ENV_TYPE === 'PROD' ? '' : 'internal-secret-key');

if (ENV_TYPE === 'PROD' && !JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is required in PROD environment');
    process.exit(1);
}
if (ENV_TYPE === 'PROD' && !INTERNAL_API_KEY) {
    console.error('[FATAL] INTERNAL_API_KEY is required in PROD environment');
    process.exit(1);
}

/**
 * Helper: Attach API key context to request and call next().
 */
async function handleApiKeyAuth(req: Request, res: Response, next: NextFunction, apiKey: any) {
    // Update usage stats (async, non-blocking)
    ApiKey.updateOne({ _id: apiKey._id }, {
        lastUsedAt: new Date(),
        lastUsedIP: req.ip || req.socket?.remoteAddress || '',
    }).exec();

    // Fetch User
    const user = await User.findById(apiKey.user);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Attach to Request
    // @ts-ignore
    req.apiKey = apiKey;
    // @ts-ignore
    req.user = {
        userId: user._id,
        role: user.role,
        email: user.email,
        department: user.department,
        departmentId: user.departmentId,
        permissions: user.permissions,
        environment: process.env.ENV_TYPE,
        isApiKey: true,
        apiKeyMode: apiKey.mode || 'agent',
        allowedDepartments: apiKey.allowedDepartments || [],
        allowedKnowledgeIds: apiKey.allowedKnowledgeIds || [],
        allowedTools: apiKey.allowedTools || ['*'],
        apiKeyModelId: apiKey.modelId || undefined,
    };

    next();
}

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

        // --- API KEY CHECK ---
        if (token.startsWith('sk_')) {
            const rawKey = token;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            // Find valid key
            // Try primary keyHash first, then check previousKeyHashes (rotation grace period)
            const now = new Date();
            ApiKey.findOne({
                revokedAt: { $exists: false },
                $and: [
                    {
                        $or: [
                            { keyHash },
                            { 'previousKeyHashes.hash': keyHash, 'previousKeyHashes.expiresAt': { $gt: now } },
                        ]
                    },
                    {
                        $or: [
                            { expiresAt: { $exists: false } },
                            { expiresAt: { $gt: now } }
                        ]
                    }
                ]
            }).then(async (apiKey) => {
                // Fallback: if primary didn't match, search previousKeyHashes separately
                if (!apiKey) {
                    const rotatedKey = await ApiKey.findOne({
                        revokedAt: { $exists: false },
                        'previousKeyHashes.hash': keyHash,
                        'previousKeyHashes.expiresAt': { $gt: now },
                        $or: [
                            { expiresAt: { $exists: false } },
                            { expiresAt: { $gt: now } }
                        ]
                    });
                    if (!rotatedKey) return res.status(401).json({ error: 'Invalid or expired API key' });
                    // Use the rotated key (grace period active)
                    return handleApiKeyAuth(req, res, next, rotatedKey);
                }

                return handleApiKeyAuth(req, res, next, apiKey);
            }).catch(err => {
                console.error('API Key Auth Error:', err);
                return res.status(500).json({ error: 'Auth Error' });
            });
            return; // Stop here, async handles next()
        }
        // --- END API KEY CHECK ---

        jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
            if (err) return res.status(401).json({ error: 'Invalid or expired token' });
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
     * Middleware guard for API Key Scopes
     */
    static requireScope(scope: string) {
        return (req: Request, res: Response, next: NextFunction) => {
            // @ts-ignore
            const apiKey = req.apiKey;

            // If superadmin (JWT or Key), allow
            // @ts-ignore
            if (req.user?.role === 'superadmin') return next();

            if (!apiKey) {
                return res.status(403).json({ error: 'Access denied: Scope required' });
            }

            if (!apiKey.scopes.includes(scope)) {
                return res.status(403).json({ error: `Missing scope: ${scope}` });
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
