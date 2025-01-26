import { Router, Request, Response, RequestHandler } from 'express';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest extends Request {
  body: { 
    messages: ChatMessage[] 
  };
}

const chatHandler: RequestHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    console.log('Chat request received:', req.body);
    const { messages } = req.body;
    
    if (!messages || messages.length === 0) {
      res.status(400).json({ error: 'Messages are required' });
      return;
    }

    const response = await ollamaService.chat(messages);
    res.json({ response });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
};

router.post('/', chatHandler);

export default router;