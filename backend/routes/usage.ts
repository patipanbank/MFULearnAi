import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import * as usageController from '../controllers/usage.controller';

const router = Router();

// All usage routes require authentication
router.use(authenticate);

// Standard roles that can access usage info
const allowedRoles: UserRole[] = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];

/**
 * GET /api/usage - Get current user's token usage
 */
router.get('/', authorize(allowedRoles), usageController.getUserUsage);

export default router;
