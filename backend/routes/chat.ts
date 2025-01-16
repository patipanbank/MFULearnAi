import express from 'express';
import LlamaService from '../services/llama';

const router = express.Router();
const llama = LlamaService.getInstance();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);
    
    const llama = LlamaService.getInstance();
    console.log('LLaMA service initialized');
    
    const prompt = `Human: ${message}\nAssistant:`;
    console.log('Sending prompt to LLaMA:', prompt);
    
    const response = await llama.generateResponse(prompt);
    console.log('LLaMA response:', response);
    
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Error generating response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
