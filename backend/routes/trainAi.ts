import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import TrainingData from '../models/TrainingData';
import jwt from 'jsonwebtoken';

const router = Router();

// เพิ่ม interface สำหรับ user จาก request
interface RequestWithUser extends Request {
  user: {
    id: string;
    // เพิ่ม properties อื่นๆ ตามที่จำเป็น
  };
}

// เพิ่ม endpoint สำหรับดูข้อมูล training ทั้งหมด
router.get('/training-data', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const trainingData = await TrainingData.find({ isActive: true })
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json(trainingData);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Failed to fetch training data',
      error: error.message 
    });
  }
});

// แก้ไข endpoint train
router.post('/train', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    
    await TrainingData.create({
      content: text
    });

    // ดึงข้อมูลทั้งหมดที่ active
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    console.log('Starting AI training with combined text');
    
    // ส่งข้อมูลทั้งหมดไป train
    const response = await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Use this knowledge to help answer questions:

${combinedContent}"
`
    });

    res.status(200).json({ 
      message: 'Training completed successfully',
      totalDataPoints: allTrainingData.length
    });

  } catch (error: any) {
    console.error('Training error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ 
      message: 'Training failed',
      error: error.message,
      details: error.response?.data 
    });
  }
});

// เพิ่ม endpoint สำหรับลบ/ปิดใช้งานข้อมูล
router.patch('/training-data/:id', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await TrainingData.findByIdAndUpdate(id, { isActive });
    
    res.json({ message: 'Training data updated successfully' });
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Failed to update training data',
      error: error.message 
    });
  }
});

export default router; 