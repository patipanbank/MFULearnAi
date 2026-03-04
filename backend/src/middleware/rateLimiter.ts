import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService';
import { redis } from '../config/redis';

const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const RATE_LIMIT = ENV_TYPE === 'PROD' ? 30 : 100;
const RATE_WINDOW_SEC = 60; // 1 minute sliding window

/**
 * Redis-backed Sliding Window Rate Limiter
 *
 * Uses a Redis Sorted Set per user to track requests within a sliding window.
 * Survives server restarts and works correctly across multiple instances.
 *
 * Fallback: if Redis is unavailable, allows the request (fail-open).
 */
export class RateLimiter {
    static async limit(req: any, res: Response, next: NextFunction) {
        // API keys bypass rate limiting (they have their own limiter)
        if (req.user?.isApiKey) {
            return next();
        }

        const userId = req.user?.userId || req.ip;
        const key = `ratelimit:${userId}`;
        const now = Date.now();
        const windowStart = now - (RATE_WINDOW_SEC * 1000);

        try {
            // Atomic pipeline: add current request, remove expired, count, set TTL
            const results = await redis
                .multi()
                .zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
                .zremrangebyscore(key, 0, windowStart)
                .zcard(key)
                .expire(key, RATE_WINDOW_SEC + 1) // TTL slightly longer than window
                .exec();

            // results[2] = [error, count] from zcard
            const count = results?.[2]?.[1] as number ?? 0;

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - count));
            res.setHeader('X-RateLimit-Reset', Math.ceil((now + RATE_WINDOW_SEC * 1000) / 1000));

            if (count > RATE_LIMIT) {
                const retryAfter = RATE_WINDOW_SEC;
                res.setHeader('Retry-After', retryAfter);
                LoggerService.log('warn', 'rate_limit_exceeded', {
                    userId,
                    count,
                    limit: RATE_LIMIT,
                    window: RATE_WINDOW_SEC
                }, userId);
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter,
                    limit: RATE_LIMIT,
                    window: `${RATE_WINDOW_SEC}s`
                });
            }

            next();
        } catch (err: unknown) {
            // Fail-open: if Redis is down, allow the request
            const message = err instanceof Error ? err.message : String(err);
            LoggerService.log('warn', 'rate_limiter_redis_error', {
                userId,
                error: message,
                action: 'fail_open'
            }, userId);
            next();
        }
    }
}
