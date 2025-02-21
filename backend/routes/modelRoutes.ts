import { Router, Request, Response } from 'express';
import { modelService } from '../services/modelService';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

/**
 * GET /api/model
 * Retrieve models belonging to the authenticated user.
 * (Assumes that middleware has added the `user` property to the request)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.username; // Adjust based on your auth implementation
    // You may want to filter models by the user.
    // Ensure that modelService.getModelsByUser exists in your modelService,
    // or replace it with the proper service method.
    const models = await modelService.getModelsByUser(userId);
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * POST /api/model/custom
 * Create a custom model.
 */
router.post('/custom', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.username;
    const { name, collections } = req.body;
    const customModel = await modelService.createCustomModel(userId, name, collections || []);
    res.status(201).json(customModel);
  } catch (error) {
    console.error('Error creating custom model:', error);
    res.status(500).json({ error: 'Failed to create custom model' });
  }
});

/**
 * POST /api/model/official
 * Create an official model.
 * Only users with the "Staffs" role are allowed to create official models.
 */
router.post('/official', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.username;
    const { name, collections } = req.body;
    const officialModel = await modelService.createOfficialModel(userId, name, collections || []);
    res.status(201).json(officialModel);
  } catch (error) {
    console.error('Error creating official model:', error);
    res.status(500).json({ error: 'Failed to create official model' });
  }
});

/**
 * PUT /api/model/:modelId/collections
 * Update the collections for a given model.
 */
router.put('/:modelId/collections', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const { collections } = req.body;
    const updatedModel = await modelService.updateModelCollections(modelId, collections);
    res.json(updatedModel);
  } catch (error) {
    console.error('Error updating model collections:', error);
    res.status(500).json({ error: 'Failed to update model collections' });
  }
});

/**
 * DELETE /api/model/:modelId
 * Delete a model by its ID.
 */
router.delete('/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    // Make sure modelService.deleteModel exists (or use findByIdAndDelete).
    const deletedModel = await modelService.deleteModel(modelId);
    res.json({ message: 'Model deleted', data: deletedModel });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router; 