"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentService_1 = require("../services/agentService");
const advancedToolService_1 = require("../services/advancedToolService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const agents = await agentService_1.agentService.getAllAgents(userId);
        return res.json(agents);
    }
    catch (error) {
        console.error('❌ Error getting agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agents'
        });
    }
});
router.get('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await agentService_1.agentService.getAgentById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.json(agent);
    }
    catch (error) {
        console.error(`❌ Error getting agent ${req.params.id}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent'
        });
    }
});
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const agentData = {
            ...req.body,
            createdBy: userId
        };
        const agent = await agentService_1.agentService.createAgent(agentData);
        return res.status(201).json(agent);
    }
    catch (error) {
        console.error('❌ Error creating agent:', error);
        return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create agent'
        });
    }
});
router.put('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;
        const updates = req.body;
        const agent = await agentService_1.agentService.updateAgent(id, updates, userId);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found or access denied'
            });
        }
        return res.json(agent);
    }
    catch (error) {
        console.error(`❌ Error updating agent ${req.params.id}:`, error);
        return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update agent'
        });
    }
});
router.delete('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.sub || req.user.id;
        const success = await agentService_1.agentService.deleteAgent(id, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found or access denied'
            });
        }
        return res.json({
            success: true,
            message: 'Agent deleted successfully'
        });
    }
    catch (error) {
        console.error(`❌ Error deleting agent ${req.params.id}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete agent'
        });
    }
});
router.get('/templates/all', auth_1.authenticateJWT, async (req, res) => {
    try {
        const templates = await agentService_1.agentService.getAgentTemplates();
        return res.json(templates);
    }
    catch (error) {
        console.error('❌ Error getting agent templates:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent templates'
        });
    }
});
router.post('/templates_create/:templateId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { templateId } = req.params;
        const userId = req.user.sub || req.user.id;
        const customizations = req.body;
        const agent = await agentService_1.agentService.createAgentFromTemplate(templateId, {
            ...customizations,
            createdBy: userId
        });
        return res.status(201).json(agent);
    }
    catch (error) {
        console.error('❌ Error creating agent from template:', error);
        return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create agent from template'
        });
    }
});
router.get('/popular', auth_1.authenticateJWT, async (req, res) => {
    try {
        const agents = await agentService_1.agentService.getPopularAgents(10);
        return res.json(agents);
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
                error: 'Invalid limit parameter'
            });
        }
        const agents = await agentService_1.agentService.getPopularAgents(limit);
        return res.json(agents);
    }
    catch (error) {
        console.error('❌ Error getting popular agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get popular agents'
        });
    }
});
router.get('/search/:query', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { query } = req.params;
        const userId = req.user.sub || req.user.id;
        const agents = await agentService_1.agentService.searchAgents(query, userId);
        return res.json(agents);
    }
    catch (error) {
        console.error('❌ Error searching agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to search agents'
        });
    }
});
router.get('/tools/available', auth_1.authenticateJWT, async (req, res) => {
    try {
        const tools = advancedToolService_1.advancedToolService.getAllTools();
        const toolInfo = tools.map(tool => ({
            name: tool.name,
            description: tool.description
        }));
        return res.json(toolInfo);
    }
    catch (error) {
        console.error('❌ Error getting available tools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get available tools'
        });
    }
});
router.get('/tools/:name', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { name } = req.params;
        const tool = advancedToolService_1.advancedToolService.getTool(name);
        if (!tool) {
            return res.status(404).json({
                success: false,
                error: 'Tool not found'
            });
        }
        return res.json({
            name: tool.name,
            description: tool.description
        });
    }
    catch (error) {
        console.error(`❌ Error getting tool ${req.params.name}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get tool'
        });
    }
});
router.post('/test/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }
        const agent = await agentService_1.agentService.getAgentById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        const testResponse = `Test response from agent "${agent.name}": ${message}`;
        return res.json({
            success: true,
            agent: agent.name,
            message: message,
            response: testResponse
        });
    }
    catch (error) {
        console.error(`❌ Error testing agent ${req.params.id}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to test agent'
        });
    }
});
router.get('/stats/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await agentService_1.agentService.getAgentById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        const stats = {
            id: agent.id,
            name: agent.name,
            usageCount: agent.usageCount,
            rating: agent.rating,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
            tools: agent.tools?.length || 0,
            collections: agent.collectionNames?.length || 0
        };
        return res.json(stats);
    }
    catch (error) {
        console.error(`❌ Error getting agent stats ${req.params.id}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent statistics'
        });
    }
});
exports.default = router;
//# sourceMappingURL=agent.js.map