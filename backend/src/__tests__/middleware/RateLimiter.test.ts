/**
 * Unit Tests — RateLimiter (Redis-backed)
 *
 * Tests the Redis-backed sliding window rate limiter.
 */

// Mock ioredis
const mockRedis = {
    multi: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zremrangebyscore: jest.fn().mockReturnThis(),
    zcard: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
        [null, 1],  // zadd
        [null, 0],  // zremrangebyscore
        [null, 1],  // zcard — 1 request in window
        [null, 1],  // expire
    ]),
    on: jest.fn(),
};

jest.mock('../../config/redis', () => ({
    redis: mockRedis,
}));

jest.mock('../../services/LoggerService', () => ({
    LoggerService: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
    }
}));

describe('Redis Rate Limiter', () => {
    let RateLimiter: any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Re-require to get fresh module
        jest.resetModules();
    });

    it('should import without errors', () => {
        expect(() => {
            RateLimiter = require('../../middleware/rateLimiter').RateLimiter;
        }).not.toThrow();
    });

    it('should have a limit method', () => {
        RateLimiter = require('../../middleware/rateLimiter').RateLimiter;
        expect(typeof RateLimiter.limit).toBe('function');
    });

    it('should bypass rate limit for API key users', () => {
        RateLimiter = require('../../middleware/rateLimiter').RateLimiter;
        const req = { user: { isApiKey: true } } as any;
        const res = {} as any;
        const next = jest.fn();

        RateLimiter.limit(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
