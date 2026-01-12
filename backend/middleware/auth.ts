import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthUser } from '../types/common';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { UserRole } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
};

/**
 * Verify and decode JWT token
 */
const verifyToken = (token: string): AuthUser => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate: RequestHandler = (
  req,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyToken(token);
    (req as AuthenticatedRequest).user = decoded;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token exists, continues regardless
 */
export const optionalAuth: RequestHandler = (
  req,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (token) {
      const decoded = verifyToken(token);
      (req as AuthenticatedRequest).user = decoded;
    }
    
    next();
  } catch {
    // Continue without user if token is invalid
    next();
  }
};

/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 * 
 * @param allowedRoles - Array of roles that can access the route
 */
export const authorize = (allowedRoles: UserRole[]): RequestHandler => {
  return (req, res: Response, next: NextFunction): void => {
    try {
      const user = (req as AuthenticatedRequest).user;
      
      if (!user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const userGroups = user.groups || [];
      const hasAllowedRole = allowedRoles.some(role => userGroups.includes(role));

      // SuperAdmin and Admin have access to everything
      const isAdmin = userGroups.includes('Admin');
      const isSuperAdmin = userGroups.includes('SuperAdmin');

      if (!hasAllowedRole && !isAdmin && !isSuperAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Combined authentication and authorization middleware
 * Convenience function that combines authenticate and authorize
 * 
 * @param allowedRoles - Array of roles that can access the route
 */
export const requireAuth = (allowedRoles?: UserRole[]): RequestHandler[] => {
  const middlewares: RequestHandler[] = [authenticate];
  
  if (allowedRoles && allowedRoles.length > 0) {
    middlewares.push(authorize(allowedRoles));
  }
  
  return middlewares;
};

/**
 * Verify WebSocket token
 * Returns decoded user or throws error
 */
export const verifyWSToken = (token: string): AuthUser => {
  return verifyToken(token);
};

/**
 * Generate JWT token for user
 */
export const generateToken = (
  payload: Partial<AuthUser>,
  expiresIn: string = '24h'
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};
