import express from 'express';
import axios from 'axios';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);

    // เช็คว่ามี custom model หรือไม่
    let modelName = 'mfu-custom-model';
    try {
      await axios.get(`http://ollama:11434/api/show`, {
        params: { name: modelName }
      });
      // ถ้ามี custom model ให้ใช้ custom model
      console.log('Using custom model:', modelName);
    } catch {
      // ถ้าไม่มีให้ใช้ llama2
      modelName = 'llama2';
      console.log('Using default model:', modelName);
    }

    const response = await axios.post('http://ollama:11434/api/generate', {
      model: modelName,
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
