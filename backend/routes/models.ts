import { Router } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import AIModel from '../models/AIModel';

const router = Router();

// Get all models
router.get('/', async (req, res) => {
  try {
    const models = await AIModel.find().sort({ createdAt: -1 });
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching models', error });
  }
});

// Create new model
router.post('/', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { displayName, description, modelType } = req.body;
    const model = await AIModel.create({
      name: `model_${Date.now()}`,
      displayName,
      description,
      modelType
    });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: 'Error creating model', error });
  }
});

export default router; 