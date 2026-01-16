import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import * as adminController from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// SuperAdmin only access
const superAdminOnly: UserRole[] = ['SuperAdmin'];

/**
 * User Management (SuperAdmin only)
 */
router.get('/users', authorize(superAdminOnly), adminController.getAllUsers);
router.put('/users/:id', authorize(superAdminOnly), adminController.updateUser);

/**
 * System Prompt Management (SuperAdmin only)
 * Note: These routes are defined BEFORE /:id to prevent conflicts
 */
router.get('/system-prompt', authorize(superAdminOnly), adminController.getSystemPrompt);
router.put('/system-prompt', authorize(superAdminOnly), adminController.updateSystemPrompt);

/**
 * Admin User Management (SuperAdmin only)
 */
router.get('/all', authorize(superAdminOnly), adminController.getAllAdmins);
router.post('/create', authorize(superAdminOnly), adminController.createAdmin);
router.get('/:id', authorize(superAdminOnly), adminController.getAdmin);
router.put('/:id', authorize(superAdminOnly), adminController.updateAdmin);
router.delete('/:id', authorize(superAdminOnly), adminController.deleteAdmin);

export default router;
