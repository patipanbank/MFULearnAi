import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    req.user = {
      sub: decoded.sub || decoded.id,
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    logger.warn('❌ JWT authentication failed', { error: error.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
}
