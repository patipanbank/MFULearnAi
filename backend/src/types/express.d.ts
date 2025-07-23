import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        sub: string;
        email?: string;
        role?: string;
        department?: string;
      };
    }
  }
}

export {}; 