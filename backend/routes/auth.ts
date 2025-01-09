import { Router, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

const router = Router();

const googleAuthHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { token } = req.body;
    // ตรวจสอบ�้อมูลผู้ใช้จาก Google
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    const userData = await response.json();

    const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAINS?.split(',') || [];
    const isAllowedDomain = (email: string) => {
      return allowedDomains.some(domain => email.endsWith('@' + domain));
    };
    if (!isAllowedDomain(userData.email)) {
      res.status(401).json({ 
        message: 'Please use your MFU email to login' 
      });
      return;
    }

    await connectDB();

    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create({
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        googleId: userData.sub,
      });
    }

    const authToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(200).json({ token: authToken });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// เพิ่ม middleware สำหรับตรวจสอบ token
const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }
};

// เพิ่ม endpoint สำหรับดึงข้อมูลผู้ใช้
router.get('/profile', authenticateToken, (async (req, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    
    res.json({
      name: user.name,
      email: user.email,
      picture: user.picture
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

router.post('/google/callback', googleAuthHandler);

export default router;
