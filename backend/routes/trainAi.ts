import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import TrainingHistory from '../models/TrainingHistory';

const router = Router();

interface RequestWithUser extends Request {
  user?: {
    nameID: string;
  };
}

router.post('/train', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const userReq = req as RequestWithUser;
    
    // บันทึกประวัติ
    const history = await TrainingHistory.create({
      text,
      trainedBy: userReq.user?.nameID,
      trainedAt: new Date(),
      status: 'training'
    });

    // ดึงประวัติการ train ทั้งหมด
    const allTraining = await TrainingHistory.find({ status: 'completed' })
      .sort({ trainedAt: 1 })  // เรียงตามเวลาจากเก่าไปใหม่
      .select('text');
    
    // รวมข้อมูลทั้งหมด รวมถึงข้อมูลใหม่
    const allKnowledge = [...allTraining.map(h => h.text), text].join('\n');

    // train โมเดลด้วยข้อมูลทั้งหมด
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM """You are an AI assistant for MFU University. Use this knowledge to help answer questions:
${allKnowledge}
"""
`
    });

    // อัพเดทสถานะ
    history.status = 'completed';
    await history.save();

    res.status(200).json({ message: 'Training completed successfully' });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ message: 'Training failed' });
  }
});

// API ดูประวัติการ train
router.get('/history', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const history = await TrainingHistory.find()
      .sort({ trainedAt: -1 })
      .select('text trainedBy trainedAt status')
      .limit(100);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

export default router; 