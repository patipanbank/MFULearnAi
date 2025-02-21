import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface RequestWithUser extends Request {
  user: Express.User;
  samlLogoutRequest?: any;
}

export const roleGuard = (allowedGroups: string[]): RequestHandler => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as RequestWithUser['user'];
      (req as RequestWithUser).user = decoded;

      if (!decoded.groups || !decoded.groups.some(group => allowedGroups.includes(group))) {
        res.status(403).json({ message: 'Access denied' });
        return;
      }

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
  }; 