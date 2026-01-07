import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
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
export const uploadRateLimiter = new RateLimiter(60 * 60 * 1000, 20); // 20 uploads per hour
export const chatRateLimiter = new RateLimiter(60 * 1000, 30); // 30 requests per minute
export const apiRateLimiter = new RateLimiter(60 * 1000, 100); // 100 requests per minute

export function createRateLimitMiddleware(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use user ID or IP address as key
    const user = (req as any).user;
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
