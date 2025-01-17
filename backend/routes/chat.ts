import express from 'express';
import axios from 'axios';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await axios.post('http://ollama:11434/api/generate', {
      model: "mfu-custom",
      prompt: message,
      stream: false
    });

    res.json({ response: response.data.response });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
