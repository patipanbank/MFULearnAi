import { Router, Request, Response, RequestHandler } from 'express';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import { ChatMessage } from '../types/chat';

const router = Router();

interface ChatRequest extends Request {
  body: { 
    messages: ChatMessage[] 
  };
}

const chatHandler: RequestHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    const { messages } = req.body;
    const userMessage = messages[0].content;

    // ค้นหาด้วย vector similarity
    const results = await chromaService.query(userMessage);
    const context = results[0] || '';

    const augmentedMessages = [
      {
        role: 'system' as const,
        content: `Use this context to answer questions: ${context}`
      },
      ...messages
    ] as ChatMessage[];

    const response = await ollamaService.chat(augmentedMessages);
    res.json({ response });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
};

router.post('/', chatHandler);

export default router;