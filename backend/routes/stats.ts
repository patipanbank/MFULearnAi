import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { ChatStats } from '../models/ChatStats';
import { Chat } from '../models/Chat';
import { ChatSentiment } from '../models/ChatSentiment';

const router = Router();

// ดึงสถิติรายวัน
router.get('/daily', roleGuard(['SuperAdmin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate && endDate) {
      // แปลงวันที่เป็นเวลาไทย
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // ปรับเวลาเป็น UTC+7
      start.setHours(start.getHours() + 7);
      end.setHours(end.getHours() + 7);
      
      // รีเซ็ตเวลาเป็นต้นวันและสิ้นวัน
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.date = {
        $gte: start,
        $lte: end
      };
    }

    const stats = await ChatStats.find(query).sort({ date: -1 });
    
    const formattedStats = stats.map(stat => ({
      date: stat.date,
      uniqueUsers: stat.uniqueUsers.length,
      totalChats: stat.totalChats,
      totalTokens: stat.totalTokens || 0
    }));

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({ error: 'Failed to fetch chat statistics' });
  }
});

// ดึงสถิติการวิเคราะห์ความรู้สึก
router.get('/sentiment', roleGuard(['SuperAdmin']), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate && endDate) {
      // แปลงวันที่เป็นเวลาไทย
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // ปรับเวลาเป็น UTC+7
      start.setHours(start.getHours() + 7);
      end.setHours(end.getHours() + 7);
      
      // รีเซ็ตเวลาเป็นต้นวันและสิ้นวัน
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    // Count by sentiment categories
    const sentimentResults = await Chat.aggregate([
      { $match: { 'metadata.sentiment': { $exists: true } } },
      ...(Object.keys(query).length > 0 ? [{ $match: query }] : []),
      { 
        $group: { 
          _id: '$metadata.sentiment',
          count: { $sum: 1 }
        } 
      },
      { $sort: { count: -1 } }
    ]);
    
    // Format results by date if date range specified
    if (startDate && endDate) {
      // Group by day and sentiment
      const dailySentiment = await Chat.aggregate([
        { $match: { 'metadata.sentiment': { $exists: true } } },
        { $match: query },
        {
          $group: {
            _id: {
              date: { 
                $dateToString: { 
                  format: '%Y-%m-%d', 
                  date: '$createdAt',
                  timezone: '+07:00' // Thai timezone
                } 
              },
              sentiment: '$metadata.sentiment'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1, count: -1 } }
      ]);

      // Restructure to format by date
      const dateMap = new Map();
      dailySentiment.forEach(item => {
        const date = item._id.date;
        const sentiment = item._id.sentiment;
        const count = item.count;
        
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            sentiments: {}
          });
        }
        
        const dateEntry = dateMap.get(date);
        dateEntry.sentiments[sentiment] = count;
      });
      
      res.json({
        overall: sentimentResults,
        daily: Array.from(dateMap.values())
      });
      return;
    }
    
    // Return just overall data if no date range
    res.json({
      overall: sentimentResults
    });
  } catch (error) {
    console.error('Error fetching sentiment stats:', error);
    res.status(500).json({ error: 'Failed to fetch sentiment statistics' });
  }
});

// Get detailed sentiment analysis with advanced filtering
router.get('/sentiment-analysis', roleGuard(['SuperAdmin']), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, sentiment, limit = 50 } = req.query;
    
    const query: any = {};
    
    // Add date range filter
    if (startDate || endDate) {
      query.dateTime = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.dateTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.dateTime.$lte = end;
      }
    }
    
    // Add sentiment filter if specified
    if (sentiment) {
      query.sentiment = sentiment;
    }
    
    // Use the static methods from the ChatSentiment model
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Get daily sentiment distribution
      const dailySentiment = await ChatSentiment.getDailySentimentStats(
        start,
        end
      );
      
      // Get overall sentiment distribution
      const overallSentiment = await ChatSentiment.getSentimentDistribution(
        start,
        end
      );
      
      // Get sample messages for each sentiment category
      const sampleMessages = await ChatSentiment.find(query)
        .sort({ dateTime: -1 })
        .limit(Number(limit))
        .select('text sentiment dateTime');
      
      res.json({
        success: true,
        dailyStats: dailySentiment,
        overallStats: overallSentiment,
        sampleMessages
      });
      return;
    }
    
    // If no date range provided, just get overall stats and samples
    const overallSentiment = await ChatSentiment.getSentimentDistribution();
    
    const sampleMessages = await ChatSentiment.find(query)
      .sort({ dateTime: -1 })
      .limit(Number(limit))
      .select('text sentiment dateTime');
    
    res.json({
      success: true,
      overallStats: overallSentiment,
      sampleMessages
    });
  } catch (error) {
    console.error('Error retrieving sentiment analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sentiment analysis data' 
    });
  }
});

export default router; 