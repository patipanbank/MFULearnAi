"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRateLimiter = exports.chatRateLimiter = exports.uploadRateLimiter = void 0;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 100) {
        this.store = {};
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    cleanup() {
        const now = Date.now();
        Object.keys(this.store).forEach(key => {
            if (this.store[key].resetTime < now) {
                delete this.store[key];
            }
        });
    }
    check(key) {
        const now = Date.now();
        const entry = this.store[key];
        if (!entry || entry.resetTime < now) {
            // Create new entry
            this.store[key] = {
                count: 1,
                resetTime: now + this.windowMs
            };
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: now + this.windowMs
            };
        }
        if (entry.count >= this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime
            };
        }
        entry.count++;
        return {
            allowed: true,
            remaining: this.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }
}
// Different rate limiters for different endpoints
exports.uploadRateLimiter = new RateLimiter(60 * 60 * 1000, 20); // 20 uploads per hour
exports.chatRateLimiter = new RateLimiter(60 * 1000, 30); // 30 requests per minute
exports.apiRateLimiter = new RateLimiter(60 * 1000, 100); // 100 requests per minute
function createRateLimitMiddleware(limiter) {
    return (req, res, next) => {
        // Use user ID or IP address as key
        const user = req.user;
        const key = user ? `${user.nameID || user.username}` : req.ip || 'anonymous';
        const result = limiter.check(key);
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limiter['maxRequests']);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
        if (!result.allowed) {
            const resetTime = new Date(result.resetTime);
            res.status(429).json({
                error: 'Too many requests',
                message: `Rate limit exceeded. Please try again after ${resetTime.toISOString()}`,
                resetTime: resetTime.toISOString()
            });
            return;
        }
        next();
    };
}
