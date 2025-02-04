import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chromaService } from '../services/chroma';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { ChatMessage } from '../types/chat';
import { roleGuard } from '../middleware/roleGuard';
import { bedrockService } from '../services/bedrock';
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

interface ChatRequest extends Request {
  body: { 
    messages: (ChatMessage & {
      image?: {
        data: string;
        mediaType: string;
      };
    })[];
    collectionName: string;
    modelId: string;
  };
}

interface Source {
  modelId: string;
  collectionName: string;
  filename: string;
  source: string;
  similarity: number;
}

const chatHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    const { messages, collectionName, modelId } = req.body;
    const user = (req as any).user;

    // ตรวจสอบสิทธิ์การเข้าถึง collection
    const hasAccess = await chromaService.checkCollectionAccess(collectionName, user);
    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied to this collection' });
      return;
    }

    const userMessage = messages[messages.length - 1].content;
    
    const matches = await chromaService.query(collectionName, userMessage);
    let context = matches[0]?.text || '';

    const augmentedMessages = [
      {
        role: 'system' as const,
        content: `You are a helpful assistant. Use this context to answer questions: ${context}`
      },
      ...messages
    ] as ChatMessage[];

    const response = await chatService.generateResponse(messages, userMessage, modelId, collectionName);
    
    const sources = matches.map((match: any) => ({
      modelId: modelId,
      collectionName: collectionName,
      filename: match.metadata?.filename || 'Unknown file',
      source: match.metadata?.source || 'N/A',
      similarity: match.score || 0
    }));

    const updatedMessages = [...messages, {
      id: Date.now(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      sources: sources
    }];

    await chatHistoryService.saveChatMessage(
      user.username,
      modelId,
      collectionName,
      updatedMessages
    );

    res.json({
      content: response,
      sources: sources
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', async (req: Request, res: Response) => {
  try {
    const { messages, modelId, collectionName } = req.body;
    const response = await chatService.generateResponse(
      messages, 
      messages[messages.length - 1].content,
      modelId,
      collectionName
    );
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

router.post('/history', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { messages, modelId, collectionName } = req.body;
    const userId = (req.user as any)?.username || '';

    // บันทึกประวัติการแชทพร้อมรูปภาพ
    const history = await chatHistoryService.saveChatMessage(
      userId,
      modelId,
      collectionName,
      messages.map((msg: { image: { data: any; mediaType: any; }; }) => ({
        ...msg,
        image: msg.image ? {
          data: msg.image.data,
          mediaType: msg.image.mediaType
        } : undefined
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
    
    // Get vector embedding
    const vector = await bedrockService.embed(text);
    
    // Get chat response
    const response = await bedrockService.chatWithVector(messages, modelId);
    
    // Send both response and vector
    res.json({
      response: response,
      vectorInfo: {
        first5Dimensions: vector.slice(0, 5),
        dimension: vector.length
      }
    });
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

router.post('/stream', verifyToken, async (req: Request, res: Response) => {
  try {
    const { messages, modelId, collectionName } = req.body;
    const user = (req as any).user;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ตรวจสอบสิทธิ์การเข้าถึง collection
    const hasAccess = await chromaService.checkCollectionAccess(collectionName, user);
    if (!hasAccess) {
      res.write(`data: ${JSON.stringify({ error: 'Access denied' })}\n\n`);
      res.end();
      return;
    }

    // Stream response
    await chatService.generateStreamingResponse(
      messages,
      messages[messages.length - 1].content,
      modelId,
      collectionName,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    );

    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
    res.end();
  }
});

export default router;