import { Router, Request, Response } from 'express';
import { ModelModel } from '../models/Model';

const router = Router();

// Create a new model (official or personal based on payload)
router.post('/', async (req: Request, res: Response) => {
  const { name, createdBy, modelType } = req.body;
  try {
    const newModel = await ModelModel.create({
      name,
      createdBy,
      collections: [],
      modelType: modelType || 'official'
    });
    res.status(201).json(newModel);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

// Retrieve all models
router.get('/', async (req: Request, res: Response) => {
  try {
    const models = await ModelModel.find({});
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

export default router; 