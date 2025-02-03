import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

interface RequestWithUser extends Request {
  user: {
    id: string;
    username: string;
    groups: string[];
  };
}

export const verifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    (req as RequestWithUser).user = decoded as RequestWithUser['user'];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}; 