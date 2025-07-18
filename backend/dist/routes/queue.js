"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queueService_1 = require("../services/queueService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.authenticateJWT, auth_1.requireAdminRole, async (req, res) => {
    try {
        const stats = await queueService_1.queueService.getQueueStats();
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting queue stats:', error);
        res.status(500).json({ error: 'Failed to get queue statistics' });
    }
});
router.get('/job/:jobId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { jobId } = req.params;
        const status = await queueService_1.queueService.getJobStatus(jobId);
        if (!status) {
            return res.status(404).json({ error: 'Job not found' });
        }
        return res.json(status);
    }
    catch (error) {
        console.error('Error getting job status:', error);
        return res.status(500).json({ error: 'Failed to get job status' });
    }
});
router.post('/chat', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens, agentId, } = req.body;
        const job = await queueService_1.queueService.addChatJob({
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
    }
    catch (error) {
        console.error('Error adding chat job:', error);
        res.status(500).json({ error: 'Failed to add chat job to queue' });
    }
});
router.post('/agent', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { agentId, userId, data } = req.body;
        const job = await queueService_1.queueService.addAgentJob({
            agentId,
            userId,
            data,
        });
        res.json({
            jobId: job.id,
            message: 'Agent job added to queue successfully',
        });
    }
    catch (error) {
        console.error('Error adding agent job:', error);
        res.status(500).json({ error: 'Failed to add agent job to queue' });
    }
});
router.post('/notification', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { userId, type, payload } = req.body;
        const job = await queueService_1.queueService.addNotificationJob({ userId, type, payload });
        res.json({
            jobId: job.id,
            message: 'Notification job added to queue successfully',
        });
    }
    catch (error) {
        console.error('Error adding notification job:', error);
        res.status(500).json({ error: 'Failed to add notification job to queue' });
    }
});
exports.default = router;
//# sourceMappingURL=queue.js.map