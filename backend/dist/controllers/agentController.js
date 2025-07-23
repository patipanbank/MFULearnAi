"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const agentService_1 = require("../services/agentService");
const errorHandler_1 = require("../middleware/errorHandler");
const sanitize_1 = require("../utils/sanitize");
class AgentController {
    static async getAllAgents(req, res) {
        const userId = req.user?.sub;
        const query = req.query;
        const agents = await agentService_1.agentService.getAllAgents(userId, query);
        const sanitizedAgents = (0, sanitize_1.sanitizeAgents)(agents);
        return res.json({
            success: true,
            data: sanitizedAgents,
            pagination: {
                total: sanitizedAgents.length,
                limit: query.limit || 50,
                offset: query.offset || 0
            }
        });
    }
    static async getAgentById(req, res) {
        const { agentId } = req.params;
        const agent = await agentService_1.agentService.getAgentById(agentId);
        if (!agent) {
            throw new errorHandler_1.NotFoundError('Agent');
        }
        const sanitizedAgent = (0, sanitize_1.sanitizeAgent)(agent);
        return res.json({
            success: true,
            data: sanitizedAgent
        });
    }
    static async createAgent(req, res) {
        const userId = req.user?.sub;
        if (!userId) {
            throw new errorHandler_1.ForbiddenError('User not authenticated');
        }
        const agentData = req.body;
        const agent = await agentService_1.agentService.createAgent({
            ...agentData,
            createdBy: userId
        });
        return res.status(201).json({
            success: true,
            data: agent
        });
    }
    static async updateAgent(req, res) {
        const { agentId } = req.params;
        const userId = req.user?.sub;
        if (!userId) {
            throw new errorHandler_1.ForbiddenError('User not authenticated');
        }
        const updates = req.body;
        const existingAgent = await agentService_1.agentService.getAgentById(agentId);
        if (!existingAgent) {
            throw new errorHandler_1.NotFoundError('Agent');
        }
        if (existingAgent.createdBy !== userId && !existingAgent.isPublic) {
            throw new errorHandler_1.ForbiddenError('You can only update your own agents');
        }
        const agent = await agentService_1.agentService.updateAgent(agentId, updates);
        if (!agent) {
            throw new errorHandler_1.NotFoundError('Agent');
        }
        return res.json({
            success: true,
            data: agent
        });
    }
    static async deleteAgent(req, res) {
        const { agentId } = req.params;
        const userId = req.user?.sub;
        if (!userId) {
            throw new errorHandler_1.ForbiddenError('User not authenticated');
        }
        const existingAgent = await agentService_1.agentService.getAgentById(agentId);
        if (!existingAgent) {
            throw new errorHandler_1.NotFoundError('Agent');
        }
        if (existingAgent.createdBy !== userId) {
            throw new errorHandler_1.ForbiddenError('You can only delete your own agents');
        }
        const success = await agentService_1.agentService.deleteAgent(agentId);
        if (!success) {
            throw new errorHandler_1.NotFoundError('Agent');
        }
        return res.json({
            success: true,
            message: 'Agent deleted successfully'
        });
    }
    static async getAgentTemplates(req, res) {
        const templates = await agentService_1.agentService.getAgentTemplates();
        return res.json({
            success: true,
            data: templates
        });
    }
    static async searchAgents(req, res) {
        const { query } = req.params;
        const userId = req.user?.sub;
        const agents = await agentService_1.agentService.searchAgents(query, userId);
        const sanitizedAgents = (0, sanitize_1.sanitizeAgents)(agents);
        return res.json({
            success: true,
            data: sanitizedAgents
        });
    }
    static async getPopularAgents(req, res) {
        const limit = parseInt(req.params.limit) || 10;
        const agents = await agentService_1.agentService.getPopularAgents(limit);
        const sanitizedAgents = (0, sanitize_1.sanitizeAgents)(agents);
        return res.json({
            success: true,
            data: sanitizedAgents
        });
    }
    static async incrementUsageCount(req, res) {
        const { agentId } = req.params;
        await agentService_1.agentService.incrementUsageCount(agentId);
        return res.json({
            success: true,
            message: 'Usage count incremented'
        });
    }
    static async updateAgentRating(req, res) {
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
            message: 'Rating updated'
        });
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=agentController.js.map