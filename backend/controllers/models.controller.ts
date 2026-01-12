import { Response } from 'express';
import { AuthenticatedRequest } from '../types/common';
import { ModelModel, ModelDocument } from '../models/Model';
import { TrainingHistory } from '../models/TrainingHistory';
import { asyncHandler } from '../middleware/errorHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) => 
  asyncHandler<AuthenticatedRequest>(fn);

/**
 * Filter models based on user permissions
 */
function filterModelsByUser(models: ModelDocument[], user: AuthenticatedRequest['user']): ModelDocument[] {
  const userId = user.nameID || user.username;
  const userGroups = user.groups || [];
  const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
  const userDepartment = user.department;

  return models.filter(model => {
    // Official models - everyone can see
    if (model.modelType === 'official') {
      return true;
    }
    
    // Personal models - only owner
    if (model.modelType === 'personal' && model.createdBy === userId) {
      return true;
    }
    
    // Department models - only same department
    if (model.modelType === 'department' && model.department === userDepartment) {
      return true;
    }
    
    return false;
  });
}

/**
 * GET /api/models - Get all models (filtered by user permissions)
 */
export const getAllModels = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const models = await ModelModel.find({}).lean() as ModelDocument[];
  const filteredModels = filterModelsByUser(models, req.user);
  res.json(filteredModels);
});

/**
 * POST /api/models - Create a new model
 */
export const createModel = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { name, modelType, department } = req.body;
  const user = req.user;

  if (!name || !modelType) {
    throw new BadRequestError('Missing required fields: name and modelType');
  }

  const userGroups = user.groups || [];
  const isAdmin = userGroups.includes('Admin') || userGroups.includes('SuperAdmin');

  // Only Admin or SuperAdmin can create official or department models
  if ((modelType === 'official' || modelType === 'department') && !isAdmin) {
    throw new ForbiddenError('Only Admin or SuperAdmin can create official or department models');
  }

  // Department models require a department field
  if (modelType === 'department' && !department) {
    throw new BadRequestError('Department is required for department models');
  }

  const createdBy = user.nameID || user.username;
  if (!createdBy) {
    throw new BadRequestError('User identifier not found in token');
  }

  const model = await ModelModel.create({
    name,
    createdBy,
    modelType,
    department: modelType === 'department' ? department : undefined,
    collections: [],
  });

  res.status(201).json(model);
});

/**
 * PUT /api/models/:id/collections - Update model's collections
 */
export const updateModelCollections = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { collections } = req.body;
  const user = req.user;

  const model = await ModelModel.findById(id);
  if (!model) {
    throw new NotFoundError('Model not found');
  }

  // Check permissions
  const userGroups = user.groups || [];
  const isStaff = userGroups.includes('Staffs') || 
                  userGroups.includes('Admin') || 
                  userGroups.includes('Students') || 
                  userGroups.includes('SuperAdmin');
  const isOwner = model.createdBy === (user.nameID || user.username);

  if (!isStaff && !isOwner) {
    throw new ForbiddenError('Permission denied');
  }

  const updatedModel = await ModelModel.findByIdAndUpdate(
    id,
    { collections },
    { new: true, runValidators: true }
  );

  if (!updatedModel) {
    throw new NotFoundError('Model not found');
  }

  // Create training history entries
  const userId = user.nameID || user.username;
  if (!userId) {
    throw new BadRequestError('User identifier not found');
  }

  await Promise.all(
    collections.map(async (collectionName: string) => {
      await TrainingHistory.create({
        userId,
        username: user.username,
        collectionName,
        documentName: model.name,
        action: 'update_collection',
        details: {
          modelId: id,
          modelName: model.name,
          collections,
        },
      });
    })
  );

  res.json(updatedModel);
});

/**
 * DELETE /api/models/:id - Delete a model
 */
export const deleteModel = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const model = await ModelModel.findByIdAndDelete(id);
  if (!model) {
    throw new NotFoundError('Model not found');
  }

  res.json({ message: 'Model deleted successfully' });
});

/**
 * GET /api/models/:id - Get model details
 */
export const getModelById = authHandler(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  const model = await ModelModel.findById(id);
  if (!model) {
    throw new NotFoundError('Model not found');
  }

  res.json(model);
});
