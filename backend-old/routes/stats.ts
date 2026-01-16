import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import * as statsController from '../controllers/stats.controller';

const router = Router();

// All stats routes require authentication
router.use(authenticate);

// SuperAdmin only access
const superAdminOnly: UserRole[] = ['SuperAdmin'];

/**
 * GET /api/stats/daily - Get daily chat statistics (SuperAdmin only)
 */
router.get('/daily', authorize(superAdminOnly), statsController.getDailyStats);

export default router; 