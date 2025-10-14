import express, { Request, Response } from 'express';
import { usageService } from '../services/usageService';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { superAdminMiddleware } from '../middleware/adminMiddleware';

const router = express.Router();

// Get current user's usage statistics and quota info
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const quotaInfo = await usageService.getUserQuotaInfo(req.user.sub);
    console.log(`📊 Usage API response for user ${req.user.sub}:`, JSON.stringify(quotaInfo, null, 2));
    return res.json(quotaInfo);
  } catch (error) {
    console.error('Error fetching user usage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific user's usage (Super Admin only)
router.get('/user/:userId', authenticateJWT, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const quotaInfo = await usageService.getUserQuotaInfo(userId);
    res.json(quotaInfo);
  } catch (error) {
    console.error('Error fetching user usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total system usage statistics (Super Admin only)
router.get('/system', authenticateJWT, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const totalUsage = await usageService.getTotalUsage();
    res.json(totalUsage);
  } catch (error) {
    console.error('Error fetching system usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user quota (Super Admin only)
router.put('/user/:userId/quota', authenticateJWT, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { tokenQuota, dailyTokenLimit } = req.body;

    await usageService.updateUserQuota(userId, tokenQuota, dailyTokenLimit);
    
    const updatedQuotaInfo = await usageService.getUserQuotaInfo(userId);
    res.json({ message: 'Quota updated successfully', quotaInfo: updatedQuotaInfo });
  } catch (error) {
    console.error('Error updating user quota:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset user usage (Super Admin only)
router.post('/user/:userId/reset', authenticateJWT, superAdminMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await usageService.resetUserUsage(userId);
    
    const updatedQuotaInfo = await usageService.getUserQuotaInfo(userId);
    res.json({ message: 'Usage reset successfully', quotaInfo: updatedQuotaInfo });
  } catch (error) {
    console.error('Error resetting user usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user can use tokens before making request
router.post('/check', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { inputTokens = 0, outputTokens = 0 } = req.body;
    const check = await usageService.checkQuotaAndUsage(req.user.sub, inputTokens, outputTokens);
    return res.json(check);
  } catch (error) {
    console.error('Error checking usage quota:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;