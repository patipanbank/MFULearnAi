import express from 'express';
import axios from 'axios';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "mistral",
      prompt: message,
      stream: false
    });

    res.json({ response: response.data.response });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(499).json({ error: 'Request cancelled' });
    } else {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
