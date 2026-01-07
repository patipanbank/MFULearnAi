import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { usageService } from '../services/usageService';
import { UserRole } from '../models/User';

const router = Router();

/**
 * GET /usage
 * Get current user's token usage
 */
router.get('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    
    if (!userId) {
      res.status(400).json({ error: 'User identifier not found' });
      return;
    }
    
    const usage = await usageService.getUserUsage(userId);
    
    // Calculate reset time (next day at 23:59 Thailand time)
    const now = new Date();
    const thaiTimeOffsetMs = 7 * 60 * 60 * 1000;
    const nowThai = new Date(now.getTime() + thaiTimeOffsetMs);
    const resetTime = new Date(nowThai);
    resetTime.setHours(23, 59, 0, 0);
    if (resetTime <= nowThai) {
      resetTime.setDate(resetTime.getDate() + 1);
    }
    const resetTimeUTC = new Date(resetTime.getTime() - thaiTimeOffsetMs);
    
    res.json({
      ...usage,
      resetTime: resetTimeUTC.toISOString(),
      percentUsed: Math.round((usage.dailyTokens / usage.tokenLimit) * 100)
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router;
