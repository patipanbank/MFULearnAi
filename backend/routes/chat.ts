import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { chromaService } from '../services/chroma';
import { chatHistoryService } from '../services/chatHistory';
import { chatService } from '../services/chat';
import { ChatMessage } from '../types/chat';

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

    const response = await chatService.generateResponse(messages, userMessage);
    
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

router.post('/', async (req, res) => {
  try {
    const { messages, collectionName } = req.body;
    const user = (req as any).user;

    if (!messages || !collectionName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const response = await chatService.generateResponse(messages, latestMessage.content);

    // Save chat history
    await chatHistoryService.saveChatMessage(
      user.username,
      'aws-bedrock',
      collectionName,
      [...messages, { role: 'assistant', content: response }]
    );

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
});

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

export default router;