import { Router, Request, Response, RequestHandler } from 'express';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import { ChatMessage } from '../types/chat';

const router = Router();

interface ChatRequest extends Request {
  body: { 
    messages: ChatMessage[];
    collectionName: string;
  };
}

const chatHandler: RequestHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    const { messages, collectionName } = req.body;
    const userMessage = messages[0].content;

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
    res.json({ response });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
};

router.post('/', chatHandler);

export default router;