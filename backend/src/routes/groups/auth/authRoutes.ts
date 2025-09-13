import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        token: 'mock-token',
        user: { id: 'user-1', username: 'test' }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        token: 'new-mock-token'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

export default router;