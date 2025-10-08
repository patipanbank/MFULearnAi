import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  departmentId?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header and attaches user info to request
 */
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No authorization header provided',
      });
      return;
    }

    // Extract token (format: "Bearer <token>")
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId,
    };

    // Continue to next middleware
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        message: error.message,
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        message: 'Please login again',
      });
      return;
    }

    // Generic error
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Optional JWT Authentication Middleware
 * Tries to extract and verify token, but doesn't fail if missing
 * Useful for routes that work with or without authentication
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      next();
      return;
    }

    // Try to verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId,
    };
  } catch (error) {
    // Silently ignore authentication errors for optional auth
    console.warn('Optional auth failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  next();
};

/**
 * Role-based Authorization Middleware
 * Checks if authenticated user has required role
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    const userRole = req.user.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
};
