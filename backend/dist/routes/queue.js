"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const queueService_1 = require("../services/queueService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateJWT, auth_1.requireAnyRole);
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const user = req.user;
        const progress = queueService_1.queueService.getJobProgress(jobId);
        if (!progress) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (progress.userId !== user._id?.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }
        return res.json(progress);
    }
    catch (error) {
        console.error('Error getting job status:', error);
        return res.status(500).json({ error: 'Failed to get job status' });
    }
});
router.get('/user/jobs', async (req, res) => {
    try {
        const user = req.user;
        const userId = user._id?.toString();
        if (!userId) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const jobs = queueService_1.queueService.getAllJobsForUser(userId);
        return res.json(jobs);
    }
    catch (error) {
        console.error('Error getting user jobs:', error);
        return res.status(500).json({ error: 'Failed to get user jobs' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'Admin' && user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const stats = await queueService_1.queueService.getQueueStats();
        return res.json(stats);
    }
    catch (error) {
        console.error('Error getting queue stats:', error);
        return res.status(500).json({ error: 'Failed to get queue stats' });
    }
});
router.post('/cleanup', async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'Admin' && user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        await queueService_1.queueService.cleanupOldJobs();
        return res.json({ message: 'Cleanup completed successfully' });
    }
    catch (error) {
        console.error('Error cleaning up jobs:', error);
        return res.status(500).json({ error: 'Failed to cleanup jobs' });
    }
});
exports.default = router;
//# sourceMappingURL=queue.js.map