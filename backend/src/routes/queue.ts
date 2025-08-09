import express, { Request, Response } from 'express';
import { queueService } from '../services/queueService';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';
import { IUser } from '../models/user';

const router = express.Router();

// Apply authentication middleware
router.use(authenticateJWT, requireAnyRole);

// GET /api/queue/status/:jobId - Get specific job status
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const user = req.user as IUser;
    
    const progress = queueService.getJobProgress(jobId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Check if user can access this job
    if (progress.userId !== user._id?.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(progress);
  } catch (error: any) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// GET /api/queue/user/jobs - Get all jobs for current user
router.get('/user/jobs', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const userId = user._id?.toString();
    
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const jobs = queueService.getAllJobsForUser(userId);
    res.json(jobs);
  } catch (error: any) {
    console.error('Error getting user jobs:', error);
    res.status(500).json({ error: 'Failed to get user jobs' });
  }
});

// GET /api/queue/stats - Get queue statistics (admin only)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    
    // Check if user is admin
    if (user.role !== 'Admin' && user.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// POST /api/queue/cleanup - Cleanup old jobs (admin only)
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    
    // Check if user is admin
    if (user.role !== 'Admin' && user.role !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await queueService.cleanupOldJobs();
    res.json({ message: 'Cleanup completed successfully' });
  } catch (error: any) {
    console.error('Error cleaning up jobs:', error);
    res.status(500).json({ error: 'Failed to cleanup jobs' });
  }
});

export default router;