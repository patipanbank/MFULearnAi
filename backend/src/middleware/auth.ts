import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export enum UserRole {
  ADMIN = 'Admin',
  STAFFS = 'Staffs',
  STUDENTS = 'Students',
  SUPER_ADMIN = 'SuperAdmin'
}

// JWT Authentication Middleware
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ detail: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    decoded.id = decoded.sub || decoded.userId;
    req.user = decoded;
    return next();
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

// Role Guard Middleware (เหมือน Python get_current_user_with_roles)
export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Authentication required' });
    }
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole as UserRole)) {
      return res.status(403).json({ detail: 'Insufficient permissions' });
    }
    return next();
  };
};

// Middleware สำหรับ /me และ /refresh (ต้องมี role ใดก็ได้)
export const requireAnyRole = requireRoles([
  UserRole.STUDENTS,
  UserRole.STAFFS,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN
]);

// Middleware สำหรับ admin endpoints
export const requireAdminRole = requireRoles([
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN
]); 