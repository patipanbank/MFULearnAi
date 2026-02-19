import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

export const rateLimitByKey = async (req: Request, res: Response, next: NextFunction) => {
    // req.apiKey should be set by authenticateApiKey (or authenticateUser if integrated)
    // @ts-ignore
    const apiKeyId = req.apiKey?._id?.toString();

    // If no API Key context, skip or fall back to IP-based?
    // If this middleware is used, it expects an API Key.
    if (!apiKeyId) {
        // If not using API Key (e.g. JWT user), maybe skip this limiter?
        // But the user specifically asked for "Rate Limiting by Key".
        // Let's assume this is strictly for API Key routes.
        return next();
    }

    const key = `rate_limit:apikey:${apiKeyId}`;
    const limit = 1000;   // requests
    const window = 3600;  // per hour (seconds)

    try {
        // Use multi/exec for atomic operations if needed, but incr/expire is fine
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, window);
        }

        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current).toString());

        if (current > limit) {
            return res.status(429).json({ error: 'Rate limit exceeded for API Key' });
        }
        next();
    } catch (error) {
        console.error('Redis Rate Limit Error:', error);
        // Fail open to avoid blocking if Redis issues
        next();
    }
};
