import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface RequestWithUser extends Request {
  user?: any;
}

export const roleGuard = (allowedGroups: string[]): RequestHandler => 
  async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
      req.user = decoded;

      const user = await User.findOne({ nameID: req.user.nameID });
      
      if (!user || !user.groups.some((group: string) => allowedGroups.includes(group))) {
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