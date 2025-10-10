import jwt from 'jsonwebtoken';
import config from '../config/config';
import { IUser } from '../models/user';

export interface JwtPayload {
  sub: string;
  nameID?: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  groups?: string[];
  role: string;
  exp: number;
}

class JwtService {
  /**
   * สร้าง JWT token สำหรับ SAML login (7 วัน)
   */
  createSamlToken(user: IUser): string {
    const payload: JwtPayload = {
      sub: (user._id as any).toString(),
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      groups: user.groups,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      algorithm: config.JWT_ALGORITHM as jwt.Algorithm
    });
  }

  /**
   * สร้าง JWT token สำหรับ Admin login (1 วัน)
   */
  createAdminToken(user: IUser): string {
    const payload: JwtPayload = {
      sub: (user._id as any).toString(),
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      groups: user.groups,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 1 วัน
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      algorithm: config.JWT_ALGORITHM as jwt.Algorithm
    });
  }

  /**
   * Refresh token (7 วัน)
   */
  refreshToken(currentPayload: any): string {
    const newPayload: JwtPayload = {
      sub: currentPayload.sub,
      nameID: currentPayload.nameID,
      username: currentPayload.username,
      email: currentPayload.email,
      firstName: currentPayload.firstName,
      lastName: currentPayload.lastName,
      department: currentPayload.department,
      groups: currentPayload.groups,
      role: currentPayload.role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 วัน
    };

    return jwt.sign(newPayload, config.JWT_SECRET, {
      algorithm: config.JWT_ALGORITHM as jwt.Algorithm
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  }
}

export const jwtService = new JwtService();
