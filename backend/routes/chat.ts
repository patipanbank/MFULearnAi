import express from 'express';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard.js';
import { AxiosError } from 'axios';
import { vectorStore } from '../lib/vectorStore.js';

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
    const { message, model = 'llama2' } = req.body;
    const currentUser = (req as RequestWithUser).user;
    const modelConfig = modelConfigs[model];

    // Check if the question is asking for personal information
    const userDataRegex = /(?:information|info|data|details)(?:\s+(?:of|about|for))?\s+([a-zA-Zก-๙\s]+)/i;
    const match = message.match(userDataRegex);

    if (match) {
      const askedPerson = match[1].trim().toLowerCase();
      const currentUserFullName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase();
      const currentUserFirstName = currentUser.firstName.toLowerCase();
      
      // Check if asking about current user (including partial name matches)
      if (!askedPerson.includes(currentUserFirstName) && 
          !askedPerson.includes(currentUserFullName)) {
        res.json({
          response: "Sorry, I cannot provide personal information about others. You can only ask about your own information.",
          model: "Llama 2 (MFU Custom)"
        });
        return;
      }
    }

    // If asking about themselves or general questions, proceed normally
    if (modelConfig.type === 'ollama') {
      const ollamaResponse = await axios.post('http://ollama:11434/api/generate', {
        model: modelConfig.name,
        prompt: message,
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

      // ค้นหาข้อมูลที่เกี่ยวข้องจาก vector store
      const relevantDocs = await vectorStore.querySimular(message);

      // สร้าง context จากข้อมูลที่เกี่ยวข้อง
      const context = relevantDocs.documents.join('\n\n');

      // ส่ง prompt พร้อม context ไปยัง LLM
      const prompt = `
      Context: ${context}
      
      Question: ${message}
      
      Please answer the question based on the context provided. If you cannot find relevant information in the context, please say so.
      `;

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
