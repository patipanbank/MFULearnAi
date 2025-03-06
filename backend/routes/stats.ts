import { Router } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { ChatStats } from '../models/ChatStats';

const router = Router();

// ดึงสถิติรายวัน
router.get('/daily', roleGuard(['SuperAdmin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      };
    }

    const stats = await ChatStats.find(query).sort({ date: -1 });
    
    const formattedStats = stats.map(stat => ({
      date: stat.date,
      uniqueUsers: stat.uniqueUsers.length,
      totalChats: stat.totalChats,
      totalMessages: stat.totalMessages
    }));

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({ error: 'Failed to fetch chat statistics' });
  }
});

export default router; 