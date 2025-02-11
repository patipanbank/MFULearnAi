import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';
import { Collection, CollectionPermission } from '../models/Collection';

const router = Router();

// Middleware to verify token
const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(verifyToken);


router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('Received chat request:', {
      body: req.body,
      headers: req.headers,
      url: req.url,
      method: req.method
    });

    const { messages, modelId, collectionName } = req.body;
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'  // 💡 ป้องกันเซิร์ฟเวอร์แคช SSE
    });

    for await (const content of chatService.generateResponse(messages, query, modelId, collectionName)) {
      console.log('Streaming response chunk:', content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
      res.flushHeaders(); // 💡 Force ส่ง response ทันที
    }

    console.log('Chat response completed');
    res.end();
  } catch (error) {
    console.error('Chat error details:', {
      error,
      stack: (error as Error).stack,
      url: req.url,
      method: req.method
    });

    // 💡 ส่งข้อความ error กลับไปยัง frontend
    res.write(`data: ${JSON.stringify({ content: '[Error]: Internal server error' })}\n\n`);
    res.end();
  }
});


router.post('/history', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { messages, modelId, collectionName } = req.body;
    const userId = (req.user as any)?.username || '';

    // แก้ไขการบันทึกประวัติให้รองรับหลายรูป
    const history = await chatHistoryService.saveChatMessage(
      userId,
      modelId,
      collectionName,
      messages.map((msg: any) => ({
        ...msg,
        images: msg.images ? msg.images.map((img: any) => ({
          data: img.data,
          mediaType: img.mediaType
        })) : undefined
      }))
    );
    res.json(history);
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

router.get('/history', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const history = await chatHistoryService.getChatHistory(userId);
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

router.route('/clear').delete(async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || !user.username) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await chatHistoryService.clearChatHistory(user.username);
    res.json(result);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, modelId } = req.body;
    const text = messages[messages.length - 1].content;
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/collections', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // ดึงข้อมูล collections จาก MongoDB
    const collections = await Collection.find({});
    
    // กรองตามสิทธิ์
    const accessibleCollections = collections.filter(collection => {
      switch (collection.permission) {
        case CollectionPermission.PUBLIC:
          return true;
        case CollectionPermission.STAFF_ONLY:
          return user.groups.includes('Staffs');
        case CollectionPermission.PRIVATE:
          return collection.createdBy === user.nameID;
        default:
          return false;
      }
    });

    // ส่งเฉพาะชื่อ collection ที่มีสิทธิ์
    res.json(accessibleCollections.map(c => c.name));
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

export default router;