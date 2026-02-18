import { Router } from 'express';
import { LogController } from '../controllers/LogController';

const router = Router();

// Create Log (for external services/frontend integration)
router.post('/', LogController.createLog);

// Query Logs (should be admin guarded or internal)
router.get('/', LogController.getLogs);

// Audit Logs
router.get('/audit', LogController.getAuditLogs);

// Dashboard Stats
router.get('/stats', LogController.getStats);
router.get('/usage', LogController.getUsage);
router.get('/usage/me', LogController.getUserUsage);

export default router;
