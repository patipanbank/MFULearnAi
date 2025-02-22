import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '../models/User';
import jwt from 'jsonwebtoken';

export const roleGuard = (allowedRoles: UserRole[]): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

      console.log('Token payload:', decoded);
      console.log('Allowed roles:', allowedRoles);
      console.log('User role:', decoded.role);

      if (!decoded.role) {
        console.error('No role found in token');
        res.status(403).json({ message: 'No role found in token' });
        return;
      }

      // Check if user's role matches any of the allowed roles
      const hasAllowedRole = allowedRoles.some(role => 
        decoded.role === role || 
        (role === 'Staffs' && decoded.role === 'ADMIN') // ADMIN can do anything Staffs can do
      );

      console.log('Has allowed role:', hasAllowedRole);

      if (!hasAllowedRole) {
        res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
        return;
      }

      // Add user info to request
      (req as any).user = decoded;
      next();
    } catch (error) {
      console.error('Role guard error:', error);
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
  };
}; 