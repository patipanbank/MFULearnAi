import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';

const router = Router();

router.post('/train', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    console.log('Starting AI training with text:', text);
    
    console.log('Sending request to Ollama...');
    const response = await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `
FROM llama2
SYSTEM You are an AI assistant for MFU University. Use this knowledge to help answer questions: ${text}
      `
    });
    console.log('Ollama response:', response.data);

    res.status(200).json({ message: 'Training completed successfully' });
  } catch (error: any) {
    console.error('Training error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ 
      message: 'Training failed',
      error: error.message,
      details: error.response?.data 
    });
  }
});

export default router; 