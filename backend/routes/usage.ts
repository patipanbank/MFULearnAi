import { Router } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { UserUsage } from '../models/UserUsage';
import User from '../models/User';

const router = Router();

router.get('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const userId = (req as any).user?.username;
    const currentDate = new Date();
    const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const [user, usage] = await Promise.all([
      User.findOne({ username: userId }),
      UserUsage.findOne({ userId, monthYear })
    ]);

    res.json({
      monthlyQuota: user?.monthlyQuota || 0,
      currentUsage: usage?.questionCount || 0,
      remainingQuota: (user?.monthlyQuota || 0) - (usage?.questionCount || 0),
      monthYear
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการใช้งาน' });
  }
});

export default router; 