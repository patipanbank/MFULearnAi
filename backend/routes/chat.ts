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

    if (!response.data || !response.data.response) {
      throw new Error('Invalid response from Ollama');
    }

    res.json({ response: response.data.response });

  } catch (error: any) {
    console.error('Error details:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
