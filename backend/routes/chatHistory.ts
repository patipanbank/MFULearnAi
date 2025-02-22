import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { chatHistoryService } from '../services/chatHistory';

const router = Router();

// ดึงประวัติการสนทนาทั้งหมดของผู้ใช้
router.get('/', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const history = await chatHistoryService.getChatHistory(userId);
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// ดึงประวัติการสนทนาเฉพาะ ID
router.get('/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.chatId;
    const chat = await chatHistoryService.getChatById(userId, chatId);
    res.json(chat);
  } catch (error) {
    console.error('Error getting specific chat:', error);
    res.status(500).json({ error: 'Failed to get specific chat' });
  }
});

// ลบประวัติการสนทนาทั้งหมด
router.delete('/', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const result = await chatHistoryService.clearChatHistory(userId);
    res.json(result);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// ลบประวัติการสนทนาเฉพาะ ID
router.delete('/:chatId', roleGuard(['Students', 'Staffs', 'Admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.username || '';
    const chatId = req.params.chatId;
    const result = await chatHistoryService.deleteChatById(userId, chatId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting specific chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router; 