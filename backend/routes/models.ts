import { Router, Request, Response } from 'express';
import { ModelModel, ModelDocument } from '../models/Model';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

/**
 * GET /api/models
 * Retrieves all models
 */
router.get('/', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const models = await ModelModel.find({}).lean();
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

/**
 * POST /api/models
 * Creates a new model
 */
router.post('/', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, modelType } = req.body;
    const user = (req as any).user;  // Get user from request (set by roleGuard)
    
    // Validate required fields
    if (!name || !modelType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Create the model with empty collections array
    const model = await ModelModel.create({
      name,
      createdBy: user.nameID,
      modelType,
      collections: [], // Start with empty collections array
    });

    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Error creating model' });
  }
});

/**
 * PUT /api/models/:id
 * Updates a model's collections
 */
router.put('/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { collections } = req.body;

    const model = await ModelModel.findByIdAndUpdate(
      id,
      { collections },
      { new: true }
    );

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json(model);
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ error: 'Error updating model' });
  }
});

/**
 * DELETE /api/models/:id
 * Deletes a model
 */
router.delete('/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const model = await ModelModel.findByIdAndDelete(id);

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Error deleting model' });
  }
});

export default router; 