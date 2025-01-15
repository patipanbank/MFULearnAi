import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

router.post('/train', roleGuard(['Admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    // ... logic สำหรับการ train AI ...
    res.status(200).json({ message: 'Training started successfully' });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ message: 'Training failed' });
  }
});

export default router; 