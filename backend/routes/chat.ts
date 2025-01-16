import express from 'express';
import LlamaService from '../services/llama';

const router = express.Router();
const llama = LlamaService.getInstance();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const prompt = `Human: ${message}\nAssistant:`;
    const response = await llama.generateResponse(prompt);
    
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
});

export default router;
