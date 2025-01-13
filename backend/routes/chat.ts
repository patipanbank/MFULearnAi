import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        prompt: message,
        stream: false
      }),
    });

    const data = await response.json();
    res.json({ response: data.response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

export default router;
