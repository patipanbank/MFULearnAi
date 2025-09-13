import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../../middleware/auth';

const router = Router();

// System health check
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'System health check failed'
    });
  }
});

// System stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system stats'
    });
  }
});

export default router;