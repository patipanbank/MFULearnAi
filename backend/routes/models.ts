import { Router, Request, Response } from 'express';
import { ModelModel, ModelDocument } from '../models/Model';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../models/User';
import { TrainingHistory } from '../models/TrainingHistory';
import { bedrockService } from '../services/bedrock';

const router = Router();

/**
 * GET /api/models
 * Retrieves all models (filtered based on user role)
 */
router.get('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const userDepartment = user.department;
    
    const models = await ModelModel.find({}).lean();
    
    const filteredModels = models.filter(model => {
      if (model.modelType === 'official') return true;
      if (model.modelType === 'personal' && model.createdBy === userId) return true;
      if (model.modelType === 'department' && model.department === userDepartment) return true;
      return false;
    });

    res.json(filteredModels);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

/**
 * POST /api/models
 * Creates a new model
 */
router.post('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, modelType, department } = req.body;
    
    if (!name || !modelType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
      res.status(403).json({ message: 'Only Admin or SuperAdmin can create official or department models' });
      return;
    }

    if (modelType === 'department' && !department) {
      res.status(400).json({ error: 'Department is required for department models' });
      return;
    }

    const createdBy = user.nameID || user.username;
    if (!createdBy) {
      res.status(400).json({ error: 'User identifier not found in token' });
      return;
    }

    const model = await ModelModel.create({
      name,
      description: `${modelType} model: ${name}`, // Add default description
      createdBy,
      modelType,
      department: modelType === 'department' ? department : undefined,
      collections: [],
    });

    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Error creating model' });
  }
});

/**
 * GET /api/models/:id
 * Retrieves a specific model by ID
 */
router.get('/:id', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const userDepartment = user.department;
    
    const model = await ModelModel.findById(id).lean();
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Check access permissions
    const hasAccess = 
      model.modelType === 'official' ||
      (model.modelType === 'personal' && model.createdBy === userId) ||
      (model.modelType === 'department' && model.department === userDepartment) ||
      userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    if (!hasAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(model);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Error fetching model' });
  }
});

/**
 * PUT /api/models/:id
 * Updates a model's general information
 */
router.put('/:id', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, modelType, department, isAgent, prompt, displayRetrievedChunks } = req.body;
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    const model = await ModelModel.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Check permissions
    const isOwner = model.createdBy === userId;
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Validate modelType changes
    if (modelType && modelType !== model.modelType) {
      if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
        res.status(403).json({ error: 'Only Admin or SuperAdmin can change model to official or department type' });
        return;
      }
    }

    // Update fields
    if (name) model.name = name;
    if (description !== undefined) model.description = description;
    if (modelType) model.modelType = modelType;
    if (department !== undefined) model.department = department;
    if (isAgent !== undefined) model.isAgent = isAgent;
    if (prompt !== undefined) model.prompt = prompt;
    if (displayRetrievedChunks !== undefined) model.displayRetrievedChunks = displayRetrievedChunks;

    await model.save();
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
router.delete('/:id', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    const model = await ModelModel.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Check permissions
    const isOwner = model.createdBy === userId;
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await ModelModel.findByIdAndDelete(id);
    
    // Log deletion
    await TrainingHistory.create({
      userId: userId,
      username: user.username,
      collectionName: 'N/A',
      documentName: model.name,
      action: 'delete_model',
      details: {
        modelId: id,
        modelName: model.name,
        modelType: model.modelType
      }
    });

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Error deleting model' });
  }
});

/**
 * PUT /api/models/:id/collections
 * Updates a model's collections (with validation)
 */
router.put('/:id/collections', roleGuard(['Staffs', 'Admin', 'Students', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { collections } = req.body;
    const user = (req as any).user;

    const model = await ModelModel.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const userGroups = user.groups || [];
    const isOwner = model.createdBy === (user.nameID || user.username);
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Validate that all collections exist and user has access
    const { CollectionModel } = await import('../models/Collection.js');
    for (const collectionName of collections) {
      const collection = await CollectionModel.findOne({ name: collectionName });
      if (!collection) {
        res.status(400).json({ error: `Collection '${collectionName}' does not exist` });
        return;
      }
      
      // Check collection access permissions
      const hasCollectionAccess = 
        collection.permission === 'PUBLIC' ||
        collection.createdBy === (user.nameID || user.username) ||
        isAdmin;
        
      if (!hasCollectionAccess) {
        res.status(403).json({ error: `No access to collection '${collectionName}'` });
        return;
      }
    }

    const updatedCollections = collections.map((collectionName: string) => ({ 
      name: collectionName,
      description: `Collection: ${collectionName}`
    }));

    const updatedModel = await ModelModel.findByIdAndUpdate(
      id,
      { collections: updatedCollections },
      { new: true, runValidators: true }
    );

    if (!updatedModel) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    
    const userId = user.nameID || user.username;
    await Promise.all(collections.map(async (collectionName: string) => {
      await TrainingHistory.create({
        userId: userId,
        username: user.username,
        collectionName: collectionName,
        documentName: model.name,
        action: 'update_collection',
        details: {
          modelId: id,
          modelName: model.name,
          collections: collections
        }
      });
    }));

    res.json(updatedModel);
  } catch (error) {
    console.error('Error updating model collections:', error);
    res.status(500).json({ error: 'Error updating model collections' });
  }
});

/**
 * POST /api/models/bulk
 * Creates multiple models in bulk
 */
router.post('/bulk', roleGuard(['Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { models } = req.body;
    const user = (req as any).user;
    const userId = user.nameID || user.username;

    if (!Array.isArray(models) || models.length === 0) {
      res.status(400).json({ error: 'Models array is required and cannot be empty' });
      return;
    }

    const createdModels = [];
    const errors = [];

    for (let i = 0; i < models.length; i++) {
      try {
        const modelData = models[i];
        const newModel = new ModelModel({
          ...modelData,
          createdBy: userId
        });
        
        await newModel.save();
        createdModels.push(newModel);
      } catch (error) {
        errors.push({
          index: i,
          model: models[i],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: createdModels.length,
      errors: errors,
      created: createdModels
    });
  } catch (error) {
    console.error('Error in bulk model creation:', error);
    res.status(500).json({ error: 'Error in bulk model creation' });
  }
});

/**
 * DELETE /api/models/bulk
 * Deletes multiple models in bulk
 */
router.delete('/bulk', roleGuard(['Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { modelIds } = req.body;
    const user = (req as any).user;
    const userId = user.nameID || user.username;

    if (!Array.isArray(modelIds) || modelIds.length === 0) {
      res.status(400).json({ error: 'Model IDs array is required and cannot be empty' });
      return;
    }

    const deletedModels = [];
    const errors = [];

    for (const modelId of modelIds) {
      try {
        const model = await ModelModel.findById(modelId);
        if (!model) {
          errors.push({
            modelId,
            error: 'Model not found'
          });
          continue;
        }

        const userGroups = user.groups || [];
        const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
        const isOwner = model.createdBy === userId;

        if (!isOwner && !isAdmin) {
          errors.push({
            modelId,
            error: 'Permission denied'
          });
          continue;
        }

        await ModelModel.findByIdAndDelete(modelId);
        deletedModels.push({
          id: modelId,
          name: model.name
        });

        // Log deletion
        await TrainingHistory.create({
          userId: userId,
          username: user.username,
          collectionName: 'N/A',
          documentName: model.name,
          action: 'bulk_delete_model',
          details: {
            modelId: modelId,
            modelName: model.name,
            modelType: model.modelType
          }
        });
      } catch (error) {
        errors.push({
          modelId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      deleted: deletedModels.length,
      errors: errors,
      deletedModels: deletedModels
    });
  } catch (error) {
    console.error('Error in bulk model deletion:', error);
    res.status(500).json({ error: 'Error in bulk model deletion' });
  }
});

/**
 * GET /api/models/search
 * Search models by name, description, or collections
 */
router.get('/search', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, modelType, department, limit = 20, offset = 0 } = req.query;
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];
    const userDepartment = user.department;
    const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

    // Build search query
    const searchQuery: any = {};
    
    // Text search
    if (q && typeof q === 'string') {
      searchQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { 'collections.name': { $regex: q, $options: 'i' } }
      ];
    }

    // Filter by model type
    if (modelType && typeof modelType === 'string') {
      searchQuery.modelType = modelType;
    }

    // Filter by department
    if (department && typeof department === 'string') {
      searchQuery.department = department;
    }

    // Access control
    if (!isAdmin) {
      searchQuery.$or = [
        { modelType: 'official' },
        { modelType: 'personal', createdBy: userId },
        { modelType: 'department', department: userDepartment }
      ];
    }

    const models = await ModelModel.find(searchQuery)
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .sort({ createdAt: -1 })
      .lean();

    const total = await ModelModel.countDocuments(searchQuery);

    res.json({
      models,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error searching models:', error);
    res.status(500).json({ error: 'Error searching models' });
  }
});

export default router;

// NOTE: The generateCollectionDescription function has been permanently removed.
