import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: UserContext;
            correlationId?: string;
        }
    }
}

export interface UserContext {
    userId: string;
    role: string;
    department?: string;
}

export const authenticateToken = (secret: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // 1. Capture Correlation ID (Phase 3 Prep)
        const correlationId = (req.headers['x-correlation-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        req.correlationId = correlationId;

        // 2. Auth Check
        let token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];

        // Fallback: Check query param (for <img> tags or direct download links)
        if (!token && req.query && req.query.token) {
            token = req.query.token as string;
        }

        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        jwt.verify(token, secret, (err: any, user: any) => {
            if (err) {
                res.status(403).json({ error: 'Invalid or expired token' });
                return;
            }
            req.user = user as UserContext;
            next();
        });
    };
};
