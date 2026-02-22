import { Router } from 'express';
import { ToolAccessController } from '../controllers/ToolAccessController';

const router = Router();

// Tool Access Management (superadmin only — guarded by middleware in server.ts)
router.get('/access', ToolAccessController.getAll);
router.put('/access/:toolName', ToolAccessController.update);
router.delete('/access/:toolName', ToolAccessController.reset);

export default router;
