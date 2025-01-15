import { Request, Response, NextFunction, RequestHandler } from 'express';
import User from '../models/User';

interface RequestWithUser extends Request {
  user?: any;
}

export const roleGuard = (allowedGroups: string[]): RequestHandler => 
  (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    User.findOne({ email: req.user.email })
      .then(user => {
        if (!user || !user.groups.some((group: string) => allowedGroups.includes(group))) {
          res.status(403).json({ message: 'Access denied' });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({ message: 'Internal server error' });
      });
  }; 