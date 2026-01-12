import { Response } from 'express';
import { AuthenticatedRequest } from '../types/common';
import { usageService } from '../services/usage.service';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError } from '../errors';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

/**
 * GET /api/usage - Get current user's token usage
 */
export const getUserUsage = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = req.user;
  const userId = user.nameID || user.username;
  
  if (!userId) {
    throw new BadRequestError('User identifier not found');
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
    percentUsed: Math.round((usage.dailyTokens / usage.tokenLimit) * 100),
  });
});
