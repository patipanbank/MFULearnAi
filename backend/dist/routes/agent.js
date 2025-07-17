"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentService_1 = require("../services/agentService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const agents = await agentService_1.agentService.getAllAgents(userId);
        return res.json({
            success: true,
            data: agents
        });
    }
    catch (error) {
        console.error('❌ Error getting agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agents'
        });
    }
});
router.get('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agent = await agentService_1.agentService.getAgentById(agentId);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        console.error('❌ Error getting agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent'
        });
    }
});
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const agentData = {
            ...req.body,
            createdBy: userId
        };
        const agent = await agentService_1.agentService.createAgent(agentData);
        return res.status(201).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        console.error('❌ Error creating agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create agent'
        });
    }
});
router.put('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { agentId } = req.params;
        const userId = req.user.id;
        const updates = req.body;
        const existingAgent = await agentService_1.agentService.getAgentById(agentId);
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        if (existingAgent.createdBy !== userId && !existingAgent.isPublic) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const agent = await agentService_1.agentService.updateAgent(agentId, updates);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        console.error('❌ Error updating agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update agent'
        });
    }
});
router.delete('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { agentId } = req.params;
        const userId = req.user.id;
        const existingAgent = await agentService_1.agentService.getAgentById(agentId);
        if (!existingAgent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        if (existingAgent.createdBy !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        const success = await agentService_1.agentService.deleteAgent(agentId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.json({
            success: true,
            message: 'Agent deleted successfully'
        });
    }
    catch (error) {
        console.error('❌ Error deleting agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete agent'
        });
    }
});
router.get('/templates/all', auth_1.authenticateJWT, async (req, res) => {
    try {
        const templates = await agentService_1.agentService.getAgentTemplates();
        return res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        console.error('❌ Error getting agent templates:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent templates'
        });
    }
});
router.post('/templates/:templateId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { templateId } = req.params;
        const userId = req.user.id;
        const customizations = {
            ...req.body,
            createdBy: userId
        };
        const agent = await agentService_1.agentService.createAgentFromTemplate(templateId, customizations);
        return res.status(201).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        console.error('❌ Error creating agent from template:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create agent from template'
        });
    }
});
router.get('/search/:query', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { query } = req.params;
        const userId = req.user.id;
        const agents = await agentService_1.agentService.searchAgents(query, userId);
        return res.json({
            success: true,
            data: agents
        });
    }
    catch (error) {
        console.error('❌ Error searching agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search agents'
        });
    }
});
router.get('/popular', auth_1.authenticateJWT, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const agents = await agentService_1.agentService.getPopularAgents(limit);
        return res.json({
            success: true,
            data: agents
        });
    }
    catch (error) {
        console.error('❌ Error getting popular agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get popular agents'
        });
    }
});
router.get('/popular/:limit', auth_1.authenticateJWT, async (req, res) => {
    try {
        const limit = parseInt(req.params.limit);
        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a positive number'
            });
        }
        const agents = await agentService_1.agentService.getPopularAgents(limit);
        return res.json({
            success: true,
            data: agents
        });
    }
    catch (error) {
        console.error('❌ Error getting popular agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get popular agents'
        });
    }
});
router.post('/:agentId/rate', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { rating } = req.body;
        if (typeof rating !== 'number' || rating < 0 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be a number between 0 and 5'
            });
        }
        await agentService_1.agentService.updateAgentRating(agentId, rating);
        return res.json({
            success: true,
            message: 'Rating updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error rating agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to rate agent'
        });
    }
});
exports.default = router;
//# sourceMappingURL=agent.js.map