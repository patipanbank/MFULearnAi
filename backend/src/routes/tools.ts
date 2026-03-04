import { Router } from 'express';
import { ToolAccessController } from '../controllers/ToolAccessController';

const router = Router();

// Tool Access Management (superadmin only — guarded by middleware in server.ts)
router.get('/access', ToolAccessController.getAll);
router.put('/access/:toolName', ToolAccessController.update);
router.delete('/access/:toolName', ToolAccessController.reset);

// Tool Discovery — public catalog of available tools with schemas & health
router.get('/discovery', ToolAccessController.discovery);

// Circuit Breaker — admin monitoring & manual reset
router.get('/circuit-breaker', ToolAccessController.circuitBreakerStatus);
router.post('/circuit-breaker/:toolName/reset', ToolAccessController.circuitBreakerReset);

// Rate Limit — admin config visibility
router.get('/rate-limit/stats', ToolAccessController.rateLimitStats);

export default router;
