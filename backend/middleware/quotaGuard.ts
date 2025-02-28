import { Request, Response, NextFunction } from 'express';
import { UserUsage } from '../models/UserUsage';
import User from '../models/User';

export const quotaGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.username;
    if (!userId) {
      res.status(401).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
      return;
    }

    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // ดึงข้อมูล quota ของ user
    const user = await User.findOne({ username: userId });
    if (!user) {
      res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
      return;
    }

    // ดึงหรือสร้างข้อมูลการใช้งานประจำเดือน
    let usage = await UserUsage.findOne({ userId, monthYear });
    if (!usage) {
      usage = new UserUsage({ userId, monthYear });
    }

    // ตรวจสอบ quota
    if (usage.questionCount >= user.monthlyQuota) {
      res.status(429).json({ 
        message: 'คุณได้ใช้โควต้าการถามคำถามของเดือนนี้หมดแล้ว',
        currentUsage: usage.questionCount,
        monthlyQuota: user.monthlyQuota
      });
      return;
    }

    // เพิ่มจำนวนการใช้งาน
    usage.questionCount += 1;
    await usage.save();

    next();
  } catch (error) {
    console.error('Quota check error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบโควต้า' });
  }
}; 