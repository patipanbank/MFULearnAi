import rateLimit from 'express-rate-limit';

// สร้าง rate limiters ต่างๆ
export const createRateLimiters = () => {
  // General API rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth endpoints rate limiter (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Chat endpoints rate limiter
  const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per windowMs
    message: {
      error: 'Too many chat requests, please slow down.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Agent creation rate limiter
  const agentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
      error: 'Too many agent creation attempts, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // File upload rate limiter
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 uploads per hour
    message: {
      error: 'Too many file uploads, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // WebSocket connection rate limiter
  const wsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 WebSocket connections per minute
    message: {
      error: 'Too many WebSocket connection attempts, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return {
    general: generalLimiter,
    auth: authLimiter,
    chat: chatLimiter,
    agent: agentLimiter,
    upload: uploadLimiter,
    websocket: wsLimiter
  };
};

// User-specific rate limiter (based on user ID)
export const createUserRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req: any) => {
      // ใช้ user ID ถ้ามี authentication
      return req.user?.id || req.ip;
    },
    message: {
      error: 'Rate limit exceeded for this user.',
      retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Admin bypass function
export const adminBypass = (req: any, res: any, next: any) => {
  if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
    // Skip rate limiting for admins
    return next();
  }
  // Continue with rate limiting for non-admins
  return next();
}; 