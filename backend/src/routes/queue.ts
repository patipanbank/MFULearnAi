import { Router } from 'express';
import { queueService } from '../services/queueService';
import { authenticateJWT, requireAdminRole } from '../middleware/auth';

const router = Router();

// Get queue statistics (admin only)
router.get('/stats', authenticateJWT, requireAdminRole, async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

// Get job status
router.get('/job/:jobId', authenticateJWT, async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await queueService.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    return res.json(status);
  } catch (error) {
    console.error('Error getting job status:', error);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Add chat job to queue
router.post('/chat', authenticateJWT, async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      message,
      modelId,
      collectionNames,
      images,
      systemPrompt,
      temperature,
      maxTokens,
      agentId,
    } = req.body;

    const job = await queueService.addChatJob({
      sessionId,
      userId,
      message,
      modelId,
      collectionNames,
      images,
      systemPrompt,
      temperature,
      maxTokens,
      agentId,
    });

    res.json({
      jobId: job.id,
      message: 'Chat job added to queue successfully',
    });
  } catch (error) {
    console.error('Error adding chat job:', error);
    res.status(500).json({ error: 'Failed to add chat job to queue' });
  }
});

// Add agent job to queue
router.post('/agent', authenticateJWT, async (req, res) => {
  try {
    const { agentId, userId, data } = req.body;

    const job = await queueService.addAgentJob({
      agentId,
      userId,
      data,
    });

    res.json({
      jobId: job.id,
      message: 'Agent job added to queue successfully',
    });
  } catch (error) {
    console.error('Error adding agent job:', error);
    res.status(500).json({ error: 'Failed to add agent job to queue' });
  }
});

// Add notification job to queue
router.post('/notification', authenticateJWT, async (req, res) => {
  try {
    const { userId, type, payload } = req.body;
    const job = await queueService.addNotificationJob({ userId, type, payload });
    res.json({
      jobId: job.id,
      message: 'Notification job added to queue successfully',
    });
  } catch (error) {
    console.error('Error adding notification job:', error);
    res.status(500).json({ error: 'Failed to add notification job to queue' });
  }
});

export default router; 