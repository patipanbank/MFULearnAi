import express from 'express';
import axios from 'axios';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    console.log('Received message:', message);
    
    const response = await axios.post('http://ollama:11434/api/generate', {
      model: "llama2",
      prompt: message,
      stream: false
    });

    console.log('Ollama response:', response.data);
    
    res.json({ response: response.data.response });

  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
