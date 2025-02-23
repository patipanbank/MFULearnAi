import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';
import { ICollection, CollectionModel, CollectionPermission } from '../models/Collection';
import { WebSocket, WebSocketServer } from 'ws';

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

export default router;