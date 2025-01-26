import { Router, Request, Response, RequestHandler } from 'express';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import { ChatMessage } from '../types/chat';
import { chatHistoryService } from '../services/chatHistory';

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
    
    // บันทึกประวัติแชท
    const updatedMessages = [...augmentedMessages, {
      id: Date.now(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date()
    }];

    await chatHistoryService.saveChatMessage(
      (req as any).user.id,
      '',
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

router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const history = await chatHistoryService.getChatHistory(userId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router;