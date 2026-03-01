/**
 * Auth Controller
 *
 * Handles authentication flows only: login, SSO, SAML, refresh, logout.
 * User CRUD → UserController, Department CRUD → DepartmentController.
 */

import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthService } from '../auth/AuthService';
import { OAuthService } from '../auth/OAuthService';
import User from '../models/User';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const JWT_SECRET = process.env.JWT_SECRET || (ENV_TYPE === 'PROD' ? '' : 'dev-secret');
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

            if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
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
                    role: user.role,
                    department: user.department,
                    departmentId: user.departmentId,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    picture: user.picture
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
        res.redirect(`${FRONTEND_URL}/login`);
    }

    static async refresh(req: any, res: Response) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        if (!JWT_SECRET) return res.status(500).json({ error: 'Server configuration error' });

        jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }, async (err: any, decoded: any) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });

            // Enforce max staleness — reject tokens issued more than 7 days ago
            const now = Math.floor(Date.now() / 1000);
            if (decoded.iat && (now - decoded.iat) > REFRESH_MAX_AGE_SECONDS) {
                return res.status(401).json({ error: 'Token too old for refresh. Please login again.' });
            }

            const user = await User.findById(decoded.userId);
            if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

            const newToken = AuthService.generateToken(user);
            res.json({ token: newToken });
        });
    }
}
