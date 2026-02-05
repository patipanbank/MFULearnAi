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
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

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
