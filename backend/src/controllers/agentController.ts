import { Request, Response } from 'express';
import { agentService } from '../services/agentService';
import { CreateAgentInput, UpdateAgentInput, AgentQuery } from '../validation/agentSchema';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler';

export class AgentController {
  // Get all agents with filtering and pagination
  static async getAllAgents(req: Request, res: Response) {
    const userId = req.user?.sub;
    const query = req.query as AgentQuery;
    
    const agents = await agentService.getAllAgents(userId, query);
    
    // Sanitize agents before sending
    const sanitizedAgents = agents.map(agent => {
      const obj = agent.toObject ? agent.toObject() : agent;
      return {
        ...obj,
        name: obj.name || '',
        description: obj.description || '',
        systemPrompt: obj.systemPrompt || '',
        modelId: obj.modelId || '',
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames : [],
        tools: Array.isArray(obj.tools) ? obj.tools : []
      };
    });

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

  // Get agent by ID
  static async getAgentById(req: Request, res: Response) {
    const { agentId } = req.params;
    
    const agent = await agentService.getAgentById(agentId);
    
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Sanitize agent before sending
    const obj = agent.toObject ? agent.toObject() : agent;
    const sanitizedAgent = {
      ...obj,
      name: obj.name || '',
      description: obj.description || '',
      systemPrompt: obj.systemPrompt || '',
      modelId: obj.modelId || '',
      tags: Array.isArray(obj.tags) ? obj.tags : [],
      collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames : [],
      tools: Array.isArray(obj.tools) ? obj.tools : []
    };

    return res.json({
      success: true,
      data: sanitizedAgent
    });
  }

  // Create new agent
  static async createAgent(req: Request, res: Response) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const agentData: CreateAgentInput = req.body;
    const agent = await agentService.createAgent({
      ...agentData,
      createdBy: userId
    });

    return res.status(201).json({
      success: true,
      data: agent
    });
  }

  // Update agent
  static async updateAgent(req: Request, res: Response) {
    const { agentId } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const updates: UpdateAgentInput = req.body;
    
    // Check if user owns this agent or if it's public
    const existingAgent = await agentService.getAgentById(agentId);
    if (!existingAgent) {
      throw new NotFoundError('Agent');
    }

    if (existingAgent.createdBy !== userId && !existingAgent.isPublic) {
      throw new ForbiddenError('You can only update your own agents');
    }

    const agent = await agentService.updateAgent(agentId, updates);
    
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    return res.json({
      success: true,
      data: agent
    });
  }

  // Delete agent
  static async deleteAgent(req: Request, res: Response) {
    const { agentId } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    // Check if user owns this agent
    const existingAgent = await agentService.getAgentById(agentId);
    if (!existingAgent) {
      throw new NotFoundError('Agent');
    }

    if (existingAgent.createdBy !== userId) {
      throw new ForbiddenError('You can only delete your own agents');
    }

    const success = await agentService.deleteAgent(agentId);
    
    if (!success) {
      throw new NotFoundError('Agent');
    }

    return res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  }

  // Get agent templates
  static async getAgentTemplates(req: Request, res: Response) {
    const templates = await agentService.getAgentTemplates();
    
    return res.json({
      success: true,
      data: templates
    });
  }

  // Search agents
  static async searchAgents(req: Request, res: Response) {
    const { query } = req.params;
    const userId = req.user?.sub;
    
    const agents = await agentService.searchAgents(query, userId);
    
    // Sanitize agents before sending
    const sanitizedAgents = agents.map(agent => {
      const obj = agent.toObject ? agent.toObject() : agent;
      return {
        ...obj,
        name: obj.name || '',
        description: obj.description || '',
        systemPrompt: obj.systemPrompt || '',
        modelId: obj.modelId || '',
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames : [],
        tools: Array.isArray(obj.tools) ? obj.tools : []
      };
    });

    return res.json({
      success: true,
      data: sanitizedAgents
    });
  }

  // Get popular agents
  static async getPopularAgents(req: Request, res: Response) {
    const limit = parseInt(req.params.limit) || 10;
    const agents = await agentService.getPopularAgents(limit);
    
    // Sanitize agents before sending
    const sanitizedAgents = agents.map(agent => {
      const obj = agent.toObject ? agent.toObject() : agent;
      return {
        ...obj,
        name: obj.name || '',
        description: obj.description || '',
        systemPrompt: obj.systemPrompt || '',
        modelId: obj.modelId || '',
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        collectionNames: Array.isArray(obj.collectionNames) ? obj.collectionNames : [],
        tools: Array.isArray(obj.tools) ? obj.tools : []
      };
    });

    return res.json({
      success: true,
      data: sanitizedAgents
    });
  }

  // Increment usage count
  static async incrementUsageCount(req: Request, res: Response) {
    const { agentId } = req.params;
    
    await agentService.incrementUsageCount(agentId);
    
    return res.json({
      success: true,
      message: 'Usage count incremented'
    });
  }

  // Update agent rating
  static async updateAgentRating(req: Request, res: Response) {
    const { agentId } = req.params;
    const { rating } = req.body;
    
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be a number between 0 and 5'
      });
    }
    
    await agentService.updateAgentRating(agentId, rating);
    
    return res.json({
      success: true,
      message: 'Rating updated'
    });
  }
} 