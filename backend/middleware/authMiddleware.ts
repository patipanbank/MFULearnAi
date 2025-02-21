import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface UserPayload extends JwtPayload {
  _id: string;
  role: string;
}

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    ) as UserPayload;
    req.user = decoded; // TypeScript now knows req.user contains _id and role
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
}; 