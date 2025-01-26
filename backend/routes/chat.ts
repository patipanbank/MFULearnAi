import { Router } from 'express';
import { chatService } from '../services/chat';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

router.post('/', roleGuard(['Staffs']), async (req, res): Promise<void> => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Invalid messages format' });
      return;
    }

    const response = await chatService.generateResponse(messages);
    res.json({ response });
    return;
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
});

export default router;