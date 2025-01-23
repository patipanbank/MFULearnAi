import express from 'express';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard.js';
import { AxiosError } from 'axios';
import { getOrCreateCollection } from '../lib/chromadb.js';

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
  gpt2: {
    type: 'huggingface',
    name: 'gpt2',
    displayName: 'GPT-like',
    apiUrl: 'https://api-inference.huggingface.co/models/gpt2'
  },
  t5: {
    type: 'huggingface', 
    name: 'google/flan-t5-base',
    displayName: 'Flan-T5',
    apiUrl: 'https://api-inference.huggingface.co/models/google/flan-t5-base'
  },
  // gpt: {
  //   type: 'huggingface',
  //   name: 'facebook/blenderbot-400M-distill',
  //   displayName: 'GPT-like',
  //   apiUrl: 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill'
  // }
  // mistral: {
  //   type: 'huggingface',
  //   name: 'facebook/opt-350m',
  //   displayName: 'OPT-350M',
  //   apiUrl: 'https://api-inference.huggingface.co/models/facebook/opt-350m'
  // }
};

interface RequestWithUser extends Request {
  user: {
    username: string;
    firstName: string;
    lastName: string;
  };
}

// Configure axios retry
axiosRetry(axios, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.code === 'EAI_AGAIN' ||
           error.response?.status === 503;
  },
  shouldResetTimeout: true
});

// Set default timeout
axios.defaults.timeout = 5000 * 60;

router.post('/chat', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { message, model } = req.body;
    const modelConfig = modelConfigs[model];

    // ค้นหาข้อมูลที่เกี่ยวข้องจาก ChromaDB
    const collection = await getOrCreateCollection();
    const results = await collection.query({
      queryTexts: [message],
      nResults: 3
    });

    // สร้าง prompt โดยรวมข้อมูลที่เกี่ยวข้อง
    const context = results.documents[0].join('\n\nRelated information:\n');
    const prompt = `Based on this context:\n${context}\n\nQuestion: ${message}\n\nAnswer:`;

    // ส่ง prompt ไปยัง AI model
    if (modelConfig.type === 'ollama') {
      const ollamaResponse = await axios.post('http://ollama:11434/api/generate', {
        model: modelConfig.name,
        prompt: prompt,
        stream: false
      });
      
      res.json({
        response: ollamaResponse.data.response,
        model: modelConfig.displayName
      });
    } else if (modelConfig.type === 'huggingface') {
      if (!modelConfig.apiUrl) {
        throw new Error('API URL is not configured for this model');
      }

      const hfResponse = await axios.post(
        modelConfig.apiUrl,
        { 
          inputs: prompt,
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
        model: modelConfig.displayName,
        warning: 'This model cannot access MFU-specific information'
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
      console.error('Hugging Face API Error:', error.message);
      if (error.response?.status === 503) {
        res.status(503).json({
          error: 'Model is currently loading or busy. Please try again in a few moments.',
          details: 'Service temporarily unavailable'
        });
      } else {
        res.status(500).json({ 
          error: 'Sorry, an error occurred. Please try again.',
          details: error.message 
        });
      }
    }
  }
});

export default router;
