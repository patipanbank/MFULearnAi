import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';
import { ICollection, CollectionModel, CollectionPermission } from '../models/Collection';
import { WebSocket, WebSocketServer } from 'ws';
import { ChatHistory } from '../models/ChatHistory';
import { UserRole } from '../models/User';

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

const wss = new WebSocketServer({ port: 5001 });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', async (message: string) => {
    try {
      const { messages, modelId, collectionName } = JSON.parse(message);
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage.content;

      console.log('Starting response generation');
      
      for await (const content of chatService.generateResponse(messages, query, modelId, collectionName)) {
        console.log('Sending chunk:', content);
        ws.send(JSON.stringify({ content }));
      }

      ws.send(JSON.stringify({ done: true }));
    } catch (error) {
      console.error('Error:', error);
      ws.send(JSON.stringify({ error: 'An error occurred' }));
    }
  });
});

router.post('/', async (req: Request, res: Response) => {
  console.log('Received chat request');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(':\n\n');
  console.log('Sent initial response');

  try {
    const { messages, modelId, collectionName } = req.body;
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content;

    const sendChunk = (content: string) => {
      const data = JSON.stringify({ content });
      res.write(`data: ${data}\n\n`);
    };

    sendChunk('');
    
    console.log('Starting response generation');
    console.log('Starting generateResponse:', {
      modelId,
      collectionName,
      messagesCount: messages.length,
      query
    });

    try {
      for await (const content of chatService.generateResponse(messages, query, modelId, collectionName)) {
        console.log('Sending chunk:', content);
        sendChunk(content);
      }
    } catch (error) {
      console.error('Error in stream generation:', error);
      sendChunk('\nขออภัย มีข้อผิดพลาดเกิดขึ้นระหว่างการสร้างคำตอบ');
    }

    console.log('Chat response completed');
    res.end();
  } catch (error) {
    console.error('Chat error details:', error);
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    
    const errorData = JSON.stringify({ content: 'ขออภัย มีข้อผิดพลาดเกิดขึ้น กรุณาลองใหม่อีกครั้ง' });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
});

router.get('/collections', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    const collections = await CollectionModel.find({});
    
    const accessibleCollections = collections.filter((collection: ICollection) => {
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

    res.json(accessibleCollections.map((c: ICollection) => c.name));
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

router.post('/history', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const { messages, modelId, collectionName, chatId } = req.body;
    const userId = (req.user as any)?.username || '';

    console.log('Received chat save request:', {
      userId,
      modelId,
      collectionName,
      chatId,
      messagesCount: messages.length
    });

    const history = await chatHistoryService.saveChatMessage(
      userId,
      modelId,
      collectionName,
      messages,
      chatId
    );

    if (history) {
      console.log('Saved chat result:', {
        _id: history._id,
        chatId: chatId,
        isNewChat: !chatId
      });
    }

    res.json(history);
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

router.get('/history', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const history = await chatHistoryService.getChatHistory(userId, page, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

router.get('/history/search', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const results = await chatHistoryService.searchChatHistory(userId, query, page, limit);
    res.json(results);
  } catch (error) {
    console.error('Error searching chat history:', error);
    res.status(500).json({ error: 'Failed to search chat history' });
  }
});

router.get('/history/:id', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.id;
    const chat = await chatHistoryService.getSpecificChat(userId, chatId);
    res.json(chat);
  } catch (error) {
    console.error('Error getting specific chat:', error);
    res.status(404).json({ error: 'Chat not found' });
  }
});

router.put('/history/:id/rename', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.id;
    const { newName } = req.body;

    if (!newName) {
      res.status(400).json({ error: 'New name is required' });
      return;
    }

    const chat = await chatHistoryService.updateChatName(userId, chatId, newName);
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat name:', error);
    res.status(500).json({ error: 'Failed to update chat name' });
  }
});

router.put('/history/:id/pin', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.id;
    const chat = await chatHistoryService.togglePinChat(userId, chatId);
    res.json(chat);
  } catch (error) {
    console.error('Error toggling pin status:', error);
    res.status(500).json({ error: 'Failed to toggle pin status' });
  }
});

router.delete('/history/:id', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.id;
    const result = await chatHistoryService.deleteChatById(userId, chatId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(404).json({ error: 'Chat not found' });
  }
});

router.delete('/history', roleGuard(['Students', 'Staffs', 'Admin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const result = await chatHistoryService.clearChatHistory(userId);
    res.json(result);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;