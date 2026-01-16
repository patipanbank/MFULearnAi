import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import * as departmentController from '../controllers/department.controller';

const router = Router();

// Public routes (optional auth for getting departments)
router.get('/', optionalAuth, departmentController.getAll);
router.get('/:id', optionalAuth, departmentController.getById);

// Protected routes (require authentication)
router.use(authenticate);

// SuperAdmin only access
const superAdminOnly: UserRole[] = ['SuperAdmin'];

/**
 * POST /api/departments - Create new department (SuperAdmin only)
 */
router.post('/', authorize(superAdminOnly), departmentController.create);

/**
 * PUT /api/departments/:id - Update department (SuperAdmin only)
 */
router.put('/:id', authorize(superAdminOnly), departmentController.update);

/**
 * DELETE /api/departments/:id - Delete department (SuperAdmin only)
 */
router.delete('/:id', authorize(superAdminOnly), departmentController.remove);

export default router; 