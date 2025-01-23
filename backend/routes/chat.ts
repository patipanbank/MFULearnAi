import express from 'express';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import { AxiosError } from 'axios';
import TrainingData from '../models/TrainingData';

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
    groups: string[];
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

router.post('/chat', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, modelName = 'mfu-custom' } = req.body;
    const currentUser = (req as RequestWithUser).user;

    const accessibleData = await TrainingData.find({
      isActive: true,
      modelName,
      accessGroups: { $in: currentUser.groups }
    });

    if (accessibleData.length === 0) {
      res.status(403).json({
        error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของโมเดลนี้'
      });
      return;
    }

    // ตรวจสอบคำถามเกี่ยวกับข้อมูลส่วนบุคคล
    const personalInfoRequest = checkPersonalInfoRequest(message);
    if (personalInfoRequest) {
      const requestedPerson = personalInfoRequest.toLowerCase();
      const currentUserName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase();

      if (!requestedPerson.includes(currentUserName)) {
        res.json({
          response: "ขออภัย ไม่สามารถให้ข้อมูลส่วนบุคคลของผู้อื่นได้",
          model: modelName
        });
        return;
      }
    }

    // ส่งคำถามไปยัง Ollama
    const ollamaResponse = await axios.post('http://ollama:11434/api/generate', {
      model: modelName,
      prompt: message,
      stream: false,
      context: {
        user: {
          groups: currentUser.groups,
          name: `${currentUser.firstName} ${currentUser.lastName}`
        }
      }
    });

    res.json({
      response: ollamaResponse.data.response,
      model: modelName
    });

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

function checkPersonalInfoRequest(message: string): string | null {
  const personalInfoPatterns = [
    /ข้อมูลของ\s*([ก-๙a-zA-Z\s]+)/i,
    /information.*about\s+([ก-๙a-zA-Z\s]+)/i,
    // เพิ่มรูปแบบอื่นๆ ตามต้องการ
  ];

  for (const pattern of personalInfoPatterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default router;
