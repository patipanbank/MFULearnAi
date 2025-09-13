"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const agentService_1 = require("../../../services/agentService");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const zod_1 = require("zod");
const router = express_1.default.Router();
exports.agentRoutes = router;
const createAgentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(100),
        description: zod_1.z.string().max(500).optional(),
        systemPrompt: zod_1.z.string().min(1),
        modelId: zod_1.z.string(),
        collectionNames: zod_1.z.array(zod_1.z.string()).default([]),
        tools: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            description: zod_1.z.string(),
            type: zod_1.z.enum(['function', 'retriever', 'web_search', 'calculator']),
            config: zod_1.z.record(zod_1.z.any()).default({}),
            enabled: zod_1.z.boolean().default(true)
        })).default([]),
        temperature: zod_1.z.number().min(0).max(2).default(0.7),
        maxTokens: zod_1.z.number().min(1).max(100000).default(4000),
        isPublic: zod_1.z.boolean().default(false),
        tags: zod_1.z.array(zod_1.z.string()).default([])
    })
});
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { includePublic, tags, search } = req.query;
        const agents = await agentService_1.agentService.getUserAgents(userId, {
            includePublic: includePublic === 'true',
            tags: tags ? (typeof tags === 'string' ? tags.split(',') : []) : undefined,
            search
        });
        return res.json({
            success: true,
            data: agents,
            meta: {
                total: agents.length,
                userId
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agents',
            code: 'AGENTS_FETCH_ERROR'
        });
    }
});
router.get('/public', async (req, res) => {
    try {
        const { category, tags, search, limit, offset } = req.query;
        const agents = await agentService_1.agentService.getPublicAgents({
            category,
            tags: tags ? (typeof tags === 'string' ? tags.split(',') : []) : undefined,
            search,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });
        return res.json({
            success: true,
            data: agents,
            meta: {
                total: agents.length,
                limit: limit ? parseInt(limit) : null,
                offset: offset ? parseInt(offset) : 0
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting public agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get public agents',
            code: 'PUBLIC_AGENTS_FETCH_ERROR'
        });
    }
});
router.get('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const agent = await agentService_1.agentService.getAgent(agentId, userId);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found',
                code: 'AGENT_NOT_FOUND'
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
            error: 'Failed to get agent',
            code: 'AGENT_FETCH_ERROR'
        });
    }
});
router.post('/', auth_1.authenticateJWT, (0, validation_1.validateRequest)(createAgentSchema), async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const agentConfig = req.body;
        const agent = await agentService_1.agentService.createAgent({
            ...agentConfig,
            createdBy: userId
        });
        return res.status(201).json({
            success: true,
            data: agent,
            message: 'Agent created successfully'
        });
    }
    catch (error) {
        console.error('❌ Error creating agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create agent',
            code: 'AGENT_CREATE_ERROR'
        });
    }
});
router.put('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const updates = req.body;
        const agent = await agentService_1.agentService.updateAgent(agentId, userId, updates);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found or access denied',
                code: 'AGENT_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: agent,
            message: 'Agent updated successfully'
        });
    }
    catch (error) {
        console.error('❌ Error updating agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update agent',
            code: 'AGENT_UPDATE_ERROR'
        });
    }
});
router.delete('/:agentId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const success = await agentService_1.agentService.deleteAgent(agentId, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found or access denied',
                code: 'AGENT_NOT_FOUND'
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
            error: 'Failed to delete agent',
            code: 'AGENT_DELETE_ERROR'
        });
    }
});
router.post('/:agentId/clone', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const { name, description } = req.body;
        const clonedAgent = await agentService_1.agentService.cloneAgent(agentId, userId);
        if (!clonedAgent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found',
                code: 'AGENT_NOT_FOUND'
            });
        }
        return res.status(201).json({
            success: true,
            data: clonedAgent,
            message: 'Agent cloned successfully'
        });
    }
    catch (error) {
        console.error('❌ Error cloning agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clone agent',
            code: 'AGENT_CLONE_ERROR'
        });
    }
});
router.post('/:agentId/test', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const { message, context } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Test message is required',
                code: 'MISSING_MESSAGE'
            });
        }
        const response = await agentService_1.agentService.testAgent(agentId, message);
        return res.json({
            success: true,
            data: response
        });
    }
    catch (error) {
        console.error('❌ Error testing agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to test agent',
            code: 'AGENT_TEST_ERROR'
        });
    }
});
router.get('/:agentId/stats', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.id;
        const { agentId } = req.params;
        const stats = await agentService_1.agentService.getAgentStats(agentId);
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found',
                code: 'AGENT_NOT_FOUND'
            });
        }
        return res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('❌ Error getting agent stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent statistics',
            code: 'AGENT_STATS_ERROR'
        });
    }
});
//# sourceMappingURL=agentRoutes.js.map