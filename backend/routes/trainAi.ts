import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import TrainingData from '../models/TrainingData';

const router = Router();

// เพิ่ม interface สำหรับ user จาก request
interface RequestWithUser extends Request {
  user: {
    nameID: string;
    firstName: string;
    lastName: string;
    groups: string[];
  };
}

// เพิ่ม endpoint สำหรับดูข้อมูล training ทั้งหมด
router.get('/training-data', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userNameID = (req as RequestWithUser).user.nameID;
    
    // ดึงเฉพาะข้อมูลที่ user สร้าง ไม่ว่าจะ active หรือไม่
    const trainingData = await TrainingData.find({ 
      'createdBy.nameID': userNameID
    }).sort({ createdAt: -1 });
    
    res.json(trainingData);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to fetch training data',
      error: err.message 
    });
  }
});

// endpoint สำหรับ train AI
router.post('/train', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    const user = (req as RequestWithUser).user;
    
    console.log('User data:', user); // เพิ่ม log เพื่อดูข้อมูล user

    await TrainingData.create({
      content: text,
      createdBy: {
        nameID: user.nameID || '',  // เพิ่ม default value
        firstName: user.firstName || '',
        lastName: user.lastName || ''
      },
      isActive: true
    });

    // ดึงข้อมูลทั้งหมดที่ active
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    console.log('Starting AI training with combined text:', combinedContent);
    
    // ส่งข้อมูลทั้งหมดไป train
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });

    res.status(200).json({ 
      message: 'Training completed successfully',
      totalDataPoints: allTrainingData.length
    });

  } catch (error: unknown) {
    console.error('Training error:', error);
    const axiosError = error as Error;
    res.status(500).json({ 
      message: 'Training failed',
      error: axiosError.message
    });
  }
});

// endpoint สำหรับเปิด/ปิดการใช้งานข้อมูล
router.patch('/training-data/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await TrainingData.findByIdAndUpdate(id, { isActive });
    
    // ดึงข้อมูลทั้งหมดที่ active และ retrain
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    // retrain model ด้วยข้อมูลที่ active
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });
    
    res.json({ 
      message: 'Training data updated and model retrained successfully',
      activeDataPoints: allTrainingData.length
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to update training data',
      error: err.message 
    });
  }
});

// endpoint สำหรับลบข้อมูล
router.delete('/training-data/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await TrainingData.findByIdAndDelete(id);
    
    // ดึงข้อมูลทั้งหมดที่ active และ retrain
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    // retrain model หลังจากลบข้อมูล
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });
    
    res.json({ 
      message: 'Training data deleted and model retrained successfully',
      activeDataPoints: allTrainingData.length
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to delete training data',
      error: err.message 
    });
  }
});

export default router; 