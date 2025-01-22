import express from 'express';
import axios from 'axios';
import { Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';

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

interface RequestWithUser extends Request {
  user: {
    nameID: string;
    firstName: string;
    lastName: string;
  };
}

router.post('/chat', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { message, model = 'llama2' } = req.body;
    const currentUser = (req as RequestWithUser).user;
    const modelConfig = modelConfigs[model];

    // Check if the question is asking for personal information
    const userDataRegex = /(?:information about|about|name|student id|phone|age|of)\s*([a-zA-Zก-๙\s]+)/i;
    const match = message.match(userDataRegex);

    let systemPrompt = '';
    if (match) {
      const askedPerson = match[1].trim().toLowerCase();
      const currentUserName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase();
      
      // If asking about someone else's information
      if (askedPerson !== currentUserName && 
          !message.toLowerCase().includes(currentUserName)) {
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
        model: "Llama 2 (MFU Custom)"
      });
    } else if (modelConfig.type === 'huggingface') {
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
