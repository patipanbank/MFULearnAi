import express from 'express';
import axios from 'axios';

const router = express.Router();

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: "mistral",
      prompt: message,
      stream: false
    });

    res.json({ response: response.data.response });

  } catch (error) {
    console.error('Ollama API Error:', error);
    res.status(500).json({ error: 'Failed to communicate with Ollama service' });
  }
});

export default router;
