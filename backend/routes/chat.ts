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

    // Normalize names for comparison
    const normalizeText = (text: string) => {
      return text.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Check for any personal information request
    const personalInfoRegex = /(student|id|phone|number|age|nickname|name|information|contact|details|data|what|who)/i;
    const containsPersonalInfoRequest = personalInfoRegex.test(message);

    // If asking about personal info, strictly verify user identity
    if (containsPersonalInfoRequest) {
      // Extract any name from the message
      const nameRegex = /([a-zA-Zก-๙]+(?:\s+[a-zA-Zก-๙]+)*)/g;
      const names = message.match(nameRegex) || [];
      
      // Check each name found in the message
      for (const name of names) {
        const normalizedName = normalizeText(name);
        // Skip common words that might be caught in the name regex
        if (['what', 'who', 'is', 'the', 'my', 'your'].includes(normalizedName)) continue;
        
        // If a name is mentioned and it's not the current user's name
        if (normalizedName !== normalizeText(currentUser.firstName) && 
            normalizedName !== normalizeText(`${currentUser.firstName} ${currentUser.lastName}`)) {
          res.json({
            response: "I apologize, but I cannot provide personal information about others. For privacy and security reasons, you can only inquire about your own information.",
            model: "Llama 2 (MFU Custom)"
          });
          return;
        }
      }
    }

    const modelConfig = modelConfigs[model];

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
