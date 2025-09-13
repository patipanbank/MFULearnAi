import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../../middleware/auth';

const router = Router();

// Get all users
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: [],
      meta: { total: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { id: req.params.userId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

export default router;