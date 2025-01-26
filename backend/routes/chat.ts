import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import { chatHistoryService } from '../services/chatHistory';

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
    messages: ChatMessage[];
    collectionName: string;
    modelId: string;
  };
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
}

const chatHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    const { messages, collectionName, modelId } = req.body;
    const user = (req as any).user;
    const userMessage = messages[messages.length - 1].content;

    // ค้นหาข้อมูลที่เกี่ยวข้องจาก ChromaDB
    const results = await chromaService.query(collectionName, userMessage);
    let context = results[0] || '';

    // สร้าง prompt ที่รวมบริบทและคำถาม
    const augmentedMessages = [
      {
        role: 'system' as const,
        content: `You are a helpful assistant. Use this context to answer questions: ${context}`
      },
      ...messages
    ] as ChatMessage[];

    const response = await ollamaService.chat(augmentedMessages);
    
    // บันทึกประวัติแชท
    const updatedMessages = [...messages, {
      id: Date.now(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString()
    }];

    await chatHistoryService.saveChatMessage(
      user.username,
      modelId,
      collectionName,
      updatedMessages
    );

    res.json({
      content: response.content
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', chatHandler);

router.route('/history').get(async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  
  if (!user || !user.username) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  chatHistoryService.getChatHistory(user.username)
    .then(history => res.json(history))
    .catch(error => {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    });
});

export default router;