import { Router, Request, Response } from 'express';
import { ModelModel } from '../models/Model';

const router = Router();

// GET /api/model - Fetch all models
router.get('/', async (req: Request, res: Response) => {
  try {
    const models = await ModelModel.find();
    res.json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

export default router; 