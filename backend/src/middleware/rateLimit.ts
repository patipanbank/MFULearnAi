import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for agent creation - simplified to avoid IPv6 issues
export const agentCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 agent creations per hour
  keyGenerator: (req) => {
    const user = req.user as any;
    return user?.sub || 'anonymous';
  },
  message: {
    success: false,
    error: 'Too many agent creations, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
});

// Rate limiter for chat endpoints - simplified to avoid IPv6 issues
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 chat messages per minute
  keyGenerator: (req) => {
    const user = req.user as any;
    return user?.sub || 'anonymous';
  },
  message: {
    success: false,
    error: 'Too many chat messages, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
}); 