import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import { chatHistoryService } from '../services/chatHistory';
import { ChatHistory } from '../models/ChatHistory';

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
    console.log('ChromaDB Response:', JSON.stringify(results, null, 2));
    
    // ตรวจสอบโครงสร้างข้อมูล
    console.log('Results type:', typeof results);
    console.log('Results structure:', Object.keys(results));
    
    // ทดลองดูค่าแรก
    if (Array.isArray(results)) {
      console.log('First result:', results[0]);
    }

    const sources = results.length > 0 ? results.map(match => ({
      modelId: req.body.modelId,
      collectionName: req.body.collectionName,
      fileName: (match as any).metadata?.fileName,
      similarity: (match as any).score
    })) : [];

    // สร้าง prompt ที่รวมบริบทและคำถาม 
    const augmentedMessages = [
      {
        role: 'system' as const,
        content: `You are a helpful assistant. Use this context to answer questions: ${results[0]}`
      },
      ...messages
    ] as ChatMessage[];

    const response = await ollamaService.chat(augmentedMessages);
    
    // บันทึกประวัติแชท
    const updatedMessages = [...messages, {
      id: Date.now(),
      role: 'assistant',
      content: response.content,
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
      content: response.content,
      sources: sources
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

router.delete('/clear', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await chatHistoryService.clearChatHistory(userId);
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Get all chat histories
router.get('/histories', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const histories = await ChatHistory.find({ userId })
      .sort({ updatedAt: -1 })
      .select('id title createdAt');
    res.json(histories);
  } catch (error) {
    console.error('Error fetching chat histories:', error);
    res.status(500).json({ error: 'Failed to fetch chat histories' });
  }
});

// Get specific chat by ID
router.get('/:chatId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const chatId = req.params.chatId;
    const chat = await ChatHistory.findOne({ _id: chatId, userId });
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }
    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Create new chat
router.post('/new', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const newChat = new ChatHistory({
      userId,
      title: 'New Chat', // หรือสร้างชื่อตาม timestamp
      messages: []
    });
    
    await newChat.save();
    res.json(newChat);
  } catch (error) {
    console.error('Error creating new chat:', error);
    res.status(500).json({ error: 'Failed to create new chat' });
  }
});

// Save chat message
router.post('/message', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { chatId, message, modelId, collectionName } = req.body;
    
    let chat;
    if (chatId) {
      chat = await ChatHistory.findOne({ _id: chatId, userId });
    } else {
      chat = await ChatHistory.findOne({ userId }).sort({ createdAt: -1 });
    }
    
    if (!chat) {
      chat = new ChatHistory({
        userId,
        title: message.substring(0, 50) + '...', // ใช้ข้อความแรกเป็นชื่อแชท
        messages: [],
        modelId,
        collectionName
      });
    }
    
    chat.messages.push(message);
    chat.updatedAt = new Date();
    await chat.save();
    
    res.json(chat);
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});

export default router;