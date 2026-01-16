import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import * as modelsController from '../controllers/models.controller';

const router = Router();

// All model routes require authentication
router.use(authenticate);

// Standard roles that can access models
const allowedRoles: UserRole[] = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];

/**
 * GET /api/models - Get all models (filtered by user permissions)
 */
router.get('/', authorize(allowedRoles), modelsController.getAllModels);

/**
 * POST /api/models - Create a new model
 */
router.post('/', authorize(allowedRoles), modelsController.createModel);

/**
 * PUT /api/models/:id/collections - Update model's collections
 */
router.put('/:id/collections', authorize(allowedRoles), modelsController.updateModelCollections);

/**
 * DELETE /api/models/:id - Delete a model
 */
router.delete('/:id', authorize(allowedRoles), modelsController.deleteModel);

/**
 * GET /api/models/:id - Get model details
 */
router.get('/:id', authorize(allowedRoles), modelsController.getModelById);

export default router;
