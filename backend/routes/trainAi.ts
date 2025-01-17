import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';

const router = Router();

router.post('/train', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    // ส่งข้อมูลไปที่ Ollama เพื่อ train
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `
FROM llama2
SYSTEM You are an AI assistant for MFU University. Use this knowledge to help answer questions: ${text}
      `
    });

    res.status(200).json({ message: 'Training completed successfully' });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ message: 'Training failed' });
  }
});

export default router; 