import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config/config';

/**
 * General API Rate Limiter
 * Applies to most API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes by default
  max: config.rateLimit.maxRequests, // 100 requests per windowMs by default
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Key generator - use user ID if authenticated, otherwise use IP
  keyGenerator: (req: Request): string => {
    return req.user?.userId || req.ip || 'unknown';
  },
  // Skip successful requests (optional)
  skipSuccessfulRequests: false,
  // Skip failed requests (optional)
  skipFailedRequests: false,
});

/**
 * Strict Rate Limiter for Auth Endpoints
 * More restrictive to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Relaxed Rate Limiter for Public Endpoints
 * More permissive for public-facing endpoints
 */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload Rate Limiter
 * Special rate limiter for file upload endpoints
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    error: 'Too many uploads',
    message: 'Upload limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.userId || req.ip || 'unknown';
  },
});

/**
 * Heavy Operation Rate Limiter
 * For computationally expensive operations (training, embeddings, etc.)
 */
export const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 heavy operations per hour
  message: {
    error: 'Too many operations',
    message: 'You have exceeded the limit for heavy operations. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.userId || req.ip || 'unknown';
  },
});

/**
 * Custom handler for rate limit exceeded
 */
export const rateLimitHandler = (
  req: Request,
  res: Response
): void => {
  res.status(429).json({
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please slow down and try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};
