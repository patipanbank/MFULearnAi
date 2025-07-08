import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skipIf?: (req: Request) => boolean;       // Skip rate limiting condition
  message?: string;    // Custom error message
  statusCode?: number; // Custom status code
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly redis: Redis;
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,          // 100 requests per window
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Too many requests. Please try again later.'
  };

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.applyRateLimit(req, res, next, this.defaultConfig);
  }

  /**
   * Create rate limit middleware with custom configuration
   */
  static create(config: Partial<RateLimitConfig>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const middleware = new RateLimitMiddleware();
      const finalConfig = { ...middleware.defaultConfig, ...config };
      middleware.applyRateLimit(req, res, next, finalConfig);
    };
  }

  /**
   * Apply rate limiting logic
   */
  private async applyRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
    config: RateLimitConfig
  ) {
    try {
      // Skip if condition is met
      if (config.skipIf && config.skipIf(req)) {
        return next();
      }

      // Generate key for this request
      const key = this.generateKey(req, config);
      const window = Math.floor(Date.now() / config.windowMs);
      const redisKey = `rate_limit:${key}:${window}`;

      // Get current count
      const current = await this.redis.incr(redisKey);
      
      // Set expiration on first request
      if (current === 1) {
        await this.redis.expire(redisKey, Math.ceil(config.windowMs / 1000));
      }

      // Check if limit exceeded
      if (current > config.maxRequests) {
        this.logger.warn(`Rate limit exceeded for key: ${key} (${current}/${config.maxRequests})`);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
          'X-RateLimit-Window': config.windowMs.toString()
        });

        throw new HttpException(
          {
            statusCode: config.statusCode,
            message: config.message,
            error: 'Too Many Requests',
            retryAfter: config.windowMs
          },
          config.statusCode || HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - current).toString(),
        'X-RateLimit-Reset': (Date.now() + config.windowMs).toString(),
        'X-RateLimit-Window': config.windowMs.toString()
      });

      // Log rate limit info in debug mode
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Rate limit info for ${key}: ${current}/${config.maxRequests}`);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Rate limit error:', error);
      // If Redis is down, let requests through
      next();
    }
  }

  /**
   * Generate rate limiting key
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    // Use custom key generator if provided
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default key generation strategy
    const user = (req as any).user;
    if (user && user.id) {
      return `user:${user.id}`;
    }

    // Fall back to IP-based limiting
    const ip = this.getClientIp(req);
    return `ip:${ip}`;
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0] : req.ip;
    return ip || 'unknown';
  }
}

/**
 * Pre-configured rate limit middlewares
 */
export class RateLimitPresets {
  
  /**
   * Strict rate limiting for authentication endpoints
   */
  static auth() {
    return RateLimitMiddleware.create({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,           // 5 attempts per window
      keyGenerator: (req) => `auth:${req.ip}`,
      message: 'Too many authentication attempts. Please try again in 15 minutes.'
    });
  }

  /**
   * API rate limiting for general endpoints
   */
  static api() {
    return RateLimitMiddleware.create({
      windowMs: 60 * 1000,  // 1 minute
      maxRequests: 60,      // 60 requests per minute
      message: 'API rate limit exceeded. Please slow down your requests.'
    });
  }

  /**
   * Upload rate limiting
   */
  static upload() {
    return RateLimitMiddleware.create({
      windowMs: 60 * 1000,  // 1 minute
      maxRequests: 10,      // 10 uploads per minute
      keyGenerator: (req) => {
        const user = (req as any).user;
        return user ? `upload:user:${user.id}` : `upload:ip:${req.ip}`;
      },
      message: 'Upload rate limit exceeded. Please wait before uploading again.'
    });
  }

  /**
   * Chat rate limiting
   */
  static chat() {
    return RateLimitMiddleware.create({
      windowMs: 60 * 1000,  // 1 minute
      maxRequests: 30,      // 30 messages per minute
      keyGenerator: (req) => {
        const user = (req as any).user;
        return user ? `chat:user:${user.id}` : `chat:ip:${req.ip}`;
      },
      message: 'Chat rate limit exceeded. Please slow down your messages.'
    });
  }

  /**
   * Admin endpoints - more lenient
   */
  static admin() {
    return RateLimitMiddleware.create({
      windowMs: 60 * 1000,  // 1 minute
      maxRequests: 200,     // 200 requests per minute
      keyGenerator: (req) => {
        const user = (req as any).user;
        return user ? `admin:user:${user.id}` : `admin:ip:${req.ip}`;
      },
      skipIf: (req) => {
        // Skip rate limiting for SuperAdmin
        const user = (req as any).user;
        return user && user.role === 'SuperAdmin';
      },
      message: 'Admin API rate limit exceeded.'
    });
  }

  /**
   * Health check endpoints - very lenient
   */
  static health() {
    return RateLimitMiddleware.create({
      windowMs: 60 * 1000,  // 1 minute
      maxRequests: 300,     // 300 requests per minute
      keyGenerator: (req) => `health:${req.ip}`,
      message: 'Health check rate limit exceeded.'
    });
  }
} 