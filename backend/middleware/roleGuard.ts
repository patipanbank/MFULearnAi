import { Request, Response, NextFunction, RequestHandler } from 'express';

export const roleGuard = (allowedRoles: string[]): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Check if user's role matches any of the allowed roles
      const hasAllowedRole = allowedRoles.some(role => 
        user.role === role || 
        (role === 'STAFF' && user.role === 'ADMIN') // ADMIN can do anything STAFF can do
      );

      if (!hasAllowedRole) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      next();
    } catch (error) {
      console.error('Role guard error:', error);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }
  };
}; 