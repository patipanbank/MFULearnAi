import express from 'express';
import axios from 'axios';

const router = express.Router();

interface ModelConfig {
  type: string;
  name: string;
  displayName: string;
  apiUrl?: string;
}

const modelConfigs: Record<string, ModelConfig> = {
  llama2: {
    type: 'ollama',
    name: 'mfu-custom',
    displayName: 'Llama 2'
  },
  gpt: {
    type: 'huggingface',
    name: 'facebook/blenderbot-400M-distill',
    displayName: 'GPT-like',
    apiUrl: 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill'
  }
};

router.post('/chat', async (req, res) => {
  try {
    const { message, model = 'llama2' } = req.body;
    const modelConfig = modelConfigs[model];

    if (modelConfig.type === 'huggingface') {
      if (!modelConfig.apiUrl) {
        throw new Error('API URL is not configured for this model');
      }

      const hfResponse = await axios.post(
        modelConfig.apiUrl,
        { 
          inputs: message,
          parameters: {
            temperature: 0.7,
            max_length: 1000,
            top_p: 0.9,
            repetition_penalty: 1.2
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let response = '';
      if (Array.isArray(hfResponse.data)) {
        response = hfResponse.data[0]?.generated_text || 'Sorry, I could not generate a response.';
      } else {
        response = hfResponse.data?.generated_text || 'Sorry, I could not generate a response.';
      }

      res.json({
        response: response,
        model: "GPT-like (Hugging Face)",
        warning: 'This model cannot access MFU-specific information'
      });
    } else {
      // Ollama response
      const ollamaResponse = await axios.post('http://ollama:11434/api/generate', {
        model: modelConfig.name,
        prompt: "I am Llama 2 model trained with MFU data. " + message,
        stream: false
      }, {
        timeout: 5000 * 60
      });

      res.json({
        response: "Llama 2: " + ollamaResponse.data.response,
        model: "Llama 2 (MFU Custom)"
      });
    }
  } catch (error: any) {
    console.error('Error:', error);
    // ตรวจสอบ error จาก Hugging Face
    if (error.response?.status === 429) {
      res.status(429).json({ 
        error: 'Sorry, the API usage limit has been exceeded. Please wait a moment and try again.',
        details: 'Rate limit exceeded'
      });
    } else {
      res.status(500).json({ 
        error: 'Sorry, an error occurred. Please try again.',
        details: error.message 
      });
    }
  }
});

export default router;
