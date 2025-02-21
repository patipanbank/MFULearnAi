import { Router, Request, Response } from 'express';
import { ModelModel, ModelDocument } from '../models/Model';
import { CollectionModel, CollectionPermission } from '../models/Collection';
import { roleGuard } from '../middleware/roleGuard';
import { chromaService } from '../services/chroma';

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
    const { name, createdBy, modelType } = req.body;
    
    // Validate required fields
    if (!name || !createdBy || !modelType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    let collections: string[] = [];

    // If it's an official model, create default collections
    if (modelType === 'official') {
      // Create default collections for official model
      const defaultCollections = [
        { name: `${name}_general`, description: 'General information' },
        { name: `${name}_faq`, description: 'Frequently asked questions' },
        { name: `${name}_policies`, description: 'Policies and procedures' }
      ];

      // Create collections in both ChromaDB and MongoDB
      for (const collection of defaultCollections) {
        try {
          // Create in ChromaDB and MongoDB using chromaService
          const newCollection = await chromaService.createCollection(
            collection.name,
            CollectionPermission.STAFF_ONLY,
            createdBy
          );
          collections.push(newCollection.name);
        } catch (error) {
          console.error(`Error creating collection ${collection.name}:`, error);
          // Continue with other collections even if one fails
        }
      }
    }

    // Create the model with the collections
    const model = await ModelModel.create({
      name,
      createdBy,
      modelType,
      collections,
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
 * Deletes a model and its associated collections if they were automatically created
 */
router.delete('/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const model = await ModelModel.findById(id);

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // If it's an official model, delete its auto-created collections
    if (model.modelType === 'official') {
      const defaultCollectionPrefixes = [
        `${model.name}_general`,
        `${model.name}_faq`,
        `${model.name}_policies`
      ];

      // Delete collections from both ChromaDB and MongoDB
      for (const collectionName of model.collections) {
        if (defaultCollectionPrefixes.some(prefix => collectionName.startsWith(prefix))) {
          try {
            await chromaService.deleteCollection(collectionName);
          } catch (error) {
            console.error(`Error deleting collection ${collectionName}:`, error);
            // Continue with other deletions even if one fails
          }
        }
      }
    }

    // Delete the model
    await ModelModel.findByIdAndDelete(id);

    res.json({ message: 'Model and associated collections deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Error deleting model' });
  }
});

export default router; 