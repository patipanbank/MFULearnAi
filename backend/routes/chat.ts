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
    name: 'microsoft/DialoGPT-large',
    displayName: 'GPT-like',
    apiUrl: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large'
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

      const enhancedPrompt = `Assistant: I am a highly capable AI assistant. I aim to be:
      - Helpful and informative
      - Clear and concise
      - Logical and analytical
      - Polite and friendly
      
      Human: ${message}
      
      Assistant: Let me provide a thoughtful response:`;

      const hfResponse = await axios.post(
        modelConfig.apiUrl,
        { 
          inputs: enhancedPrompt,
          parameters: {
            max_length: 1500,
            temperature: 0.8,
            top_p: 0.95,
            top_k: 50,
            repetition_penalty: 1.3,
            length_penalty: 1.0,
            no_repeat_ngram_size: 3
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
        response = hfResponse.data[0]?.generated_text || 'I apologize, but I could not generate a proper response.';
      } else {
        response = hfResponse.data?.generated_text || 'I apologize, but I could not generate a proper response.';
      }

      response = response
        .replace(enhancedPrompt, '')
        .replace('Assistant:', '')
        .trim();

      res.json({
        response: response,
        model: "GPT-like (Enhanced)",
        warning: 'Using enhanced conversational capabilities'
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
    if (error.response?.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        details: 'Too many requests'
      });
    } else {
      res.status(500).json({ 
        error: 'An error occurred while processing your request.',
        details: error.message 
      });
    }
  }
});

export default router;
