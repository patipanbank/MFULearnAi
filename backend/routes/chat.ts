import { Router, Request, Response, RequestHandler } from 'express';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';

const router = Router();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest extends Request {
  body: { message: string };
}

const chatHandler: RequestHandler = async (req: ChatRequest, res: Response): Promise<void> => {
  try {
    console.log('Chat request received:', req.body);
    
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // ค้นหาข้อมูลที่เกี่ยวข้องจาก ChromaDB
    const results = await chromaService.queryCollection(message);

    // สร้าง context จากผลลัพธ์
    const context = results.documents[0].join('\n');

    // ส่งคำถามพร้อม context ไปยัง Ollama
    const messages: ChatMessage[] = [{
      role: 'user',
      content: `Context: ${context}\n\nQuestion: ${message}\n\nAnswer:`
    }];
    const response = await ollamaService.chat(messages);

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error processing chat request' });
  }
};

router.post('/', chatHandler);

export default router;