"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../../../services/chatService");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const zod_1 = require("zod");
const router = express_1.default.Router();
exports.sessionRoutes = router;
const createSessionSchema = zod_1.z.object({
    body: zod_1.z.object({
        agentId: zod_1.z.string(),
        name: zod_1.z.string().min(1).max(100).optional(),
        config: zod_1.z.object({
            temperature: zod_1.z.number().min(0).max(2).optional(),
            maxTokens: zod_1.z.number().min(1).max(100000).optional(),
            systemPrompt: zod_1.z.string().optional()
        }).optional()
    })
});
router.get('/active', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const sessions = await chatService_1.chatService.getActiveSessions(userId);
        return res.json({
            success: true,
            data: sessions,
            meta: {
                total: sessions.length,
                userId
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting active sessions:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get active sessions',
            code: 'SESSIONS_FETCH_ERROR'
        });
    }
});
router.post('/', auth_1.authenticateJWT, (0, validation_1.validateRequest)(createSessionSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId, name, config } = req.body;
        const session = await chatService_1.chatService.createSession({
            userId,
            agentId,
            name: name || `Session ${Date.now()}`,
            config
        });
        return res.status(201).json({
            success: true,
            data: session,
            message: 'Session created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error creating session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create session',
            code: 'SESSION_CREATE_ERROR'
        });
    }
});
router.get('/:sessionId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { sessionId } = req.params;
        const session = await chatService_1.chatService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: session
        });
    }
    catch (error) {
        console.error('❌ Error getting session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get session',
            code: 'SESSION_FETCH_ERROR'
        });
    }
});
router.put('/:sessionId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { sessionId } = req.params;
        const updates = req.body;
        const session = await chatService_1.chatService.updateSession(sessionId, updates);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: session,
            message: 'Session updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error updating session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update session',
            code: 'SESSION_UPDATE_ERROR'
        });
    }
});
router.post('/:sessionId/end', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { sessionId } = req.params;
        const success = await chatService_1.chatService.endSession(sessionId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            message: 'Session ended successfully'
        });
    }
    catch (error) {
        console.error('❌ Error ending session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to end session',
            code: 'SESSION_END_ERROR'
        });
    }
});
router.get('/:sessionId/stats', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { sessionId } = req.params;
        const stats = await chatService_1.chatService.getSessionStats(sessionId);
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('❌ Error getting session stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get session statistics',
            code: 'SESSION_STATS_ERROR'
        });
    }
});
router.post('/:sessionId/transfer', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { sessionId } = req.params;
        const { targetAgentId, reason } = req.body;
        if (!targetAgentId) {
            return res.status(400).json({
                success: false,
                error: 'Target agent ID is required',
                code: 'MISSING_AGENT_ID'
            });
        }
        const session = await chatService_1.chatService.transferSession(sessionId, targetAgentId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: session,
            message: 'Session transferred successfully'
        });
    }
    catch (error) {
        console.error('❌ Error transferring session:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to transfer session',
            code: 'SESSION_TRANSFER_ERROR'
        });
    }
});
//# sourceMappingURL=sessionRoutes.js.map