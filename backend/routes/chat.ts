import express from 'express';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { AxiosError } from 'axios';
import { VectorDBService } from '../services/vectorDb';
import { TextProcessing } from '../services/textProcessing';

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

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    // 1. Query Embedding
    const vectorDb = new VectorDBService();
    const relevantDocs = await vectorDb.querySimular(message);

    // 2-3. Retrieve Relevant Data
    const context = relevantDocs.documents.join('\n');

    // 4-5. Generate Response with LLM
    const prompt = `
Context: ${context}
Question: ${message}
Please answer based on the context provided.`;

    const response = await TextProcessing.generateResponse(prompt);
    
    res.json({ response });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
});

export default router;
