import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole } from '../models/user';

export interface AdminRequest extends AuthenticatedRequest {
  // Admin-specific properties if needed
}

export interface SuperAdminRequest extends AuthenticatedRequest {
  // Super Admin-specific properties if needed
}

// Department-level permissions: STAFF, ADMIN, SUPER_ADMIN (collection/agent management)
export const departmentMiddleware = (req: AdminRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(403).json({ error: 'Authentication required' });
      return;
    }

    // Check if user has department management privileges (STAFF level and above)
    if (req.user.role !== UserRole.STAFFS &&
        req.user.role !== UserRole.ADMIN &&
        req.user.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Staff level privileges required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Department middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// System-level permissions: SUPER_ADMIN only (usage management, system stats)
export const superAdminMiddleware = (req: SuperAdminRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(403).json({ error: 'Authentication required' });
      return;
    }

    // Check if user has super admin privileges
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Super Admin privileges required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Super Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Legacy adminMiddleware - now for backwards compatibility, equivalent to departmentMiddleware
export const adminMiddleware = departmentMiddleware;