import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService';

const rateLimits = new Map<string, { count: number; resetTime: number }>();
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;
const RATE_WINDOW = 60 * 1000;

export class RateLimiter {
    static limit(req: any, res: Response, next: NextFunction) {
        const userId = req.user?.userId || req.ip;
        const now = Date.now();
        const userLimit = rateLimits.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
            return next();
        }

        if (userLimit.count >= RATE_LIMIT) {
            LoggerService.log('warn', 'rate_limit_exceeded', { userId }, userId);
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
            });
        }

        userLimit.count++;
        next();
    }
}
