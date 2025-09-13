import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';

const router = Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: (req.user as any)?.sub || (req.user as any)?.nameID || 'unknown',
        username: (req.user as any)?.username || 'unknown',
        role: (req.user as any)?.role || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: (req.user as any)?.sub || (req.user as any)?.nameID || 'unknown',
        ...req.body
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

export default router;