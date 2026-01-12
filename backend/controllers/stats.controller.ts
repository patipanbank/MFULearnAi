import { Response } from 'express';
import { AuthenticatedRequest } from '../types/common';
import { ChatStats } from '../models/ChatStats';
import { asyncHandler } from '../middleware/errorHandler';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

/**
 * GET /api/stats/daily - Get daily chat statistics (SuperAdmin only)
 */
export const getDailyStats = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { startDate, endDate } = req.query;
  
  const query: Record<string, unknown> = {};
  if (startDate && endDate) {
    // Convert dates to Thailand time
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    // Adjust to UTC+7
    start.setHours(start.getHours() + 7);
    end.setHours(end.getHours() + 7);
    
    // Reset to start and end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    query.date = {
      $gte: start,
      $lte: end,
    };
  }

  const stats = await ChatStats.find(query).sort({ date: -1 });
  
  const formattedStats = stats.map(stat => ({
    date: stat.date,
    uniqueUsers: stat.uniqueUsers.length,
    totalChats: stat.totalChats,
    totalTokens: stat.totalTokens || 0,
  }));

  res.json(formattedStats);
});
