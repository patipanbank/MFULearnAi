import express from 'express';
import { agentService } from '../../../services/agentService';
import { authenticateJWT } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { z } from 'zod';

/**
 * Agent Main Routes - จัดการ agent configurations และ operations
 */
const router = express.Router();

// Validation schemas
const createAgentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    systemPrompt: z.string().min(1),
    modelId: z.string(),
    collectionNames: z.array(z.string()).default([]),
    tools: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      type: z.enum(['function', 'retriever', 'web_search', 'calculator']),
      config: z.record(z.any()).default({}),
      enabled: z.boolean().default(true)
    })).default([]),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(100000).default(4000),
    isPublic: z.boolean().default(false),
    tags: z.array(z.string()).default([])
  })
});

// Get all agents for user
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { includePublic, tags, search } = req.query;
    
    const agents = await agentService.getUserAgents(userId, {
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
  } catch (error) {
    console.error('❌ Error getting agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agents',
      code: 'AGENTS_FETCH_ERROR'
    });
  }
});

// Get public agents (marketplace)
router.get('/public', async (req, res) => {
  try {
    const { category, tags, search, limit, offset } = req.query;
    
    const agents = await agentService.getPublicAgents({
      category,
      tags: tags ? (typeof tags === 'string' ? tags.split(',') : []) : undefined,
      search,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });
    
    return res.json({
      success: true,
      data: agents,
      meta: {
        total: agents.length,
        limit: limit ? parseInt(limit as string) : null,
        offset: offset ? parseInt(offset as string) : 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting public agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get public agents',
      code: 'PUBLIC_AGENTS_FETCH_ERROR'
    });
  }
});

// Get specific agent
router.get('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId } = req.params;
    
    const agent = await agentService.getAgent(agentId, userId);
    
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
  } catch (error) {
    console.error('❌ Error getting agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent',
      code: 'AGENT_FETCH_ERROR'
    });
  }
});

// Create new agent
router.post('/', authenticateJWT, validateRequest(createAgentSchema), async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const agentConfig = req.body;
    
    const agent = await agentService.createAgent({
      ...agentConfig,
      createdBy: userId
    });
    
    return res.status(201).json({
      success: true,
      data: agent,
      message: 'Agent created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create agent',
      code: 'AGENT_CREATE_ERROR'
    });
  }
});

// Update agent
router.put('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId } = req.params;
    const updates = req.body;
    
    const agent = await agentService.updateAgent(agentId, userId, updates);
    
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
  } catch (error) {
    console.error('❌ Error updating agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update agent',
      code: 'AGENT_UPDATE_ERROR'
    });
  }
});

// Delete agent
router.delete('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId } = req.params;
    
    const success = await agentService.deleteAgent(agentId, userId);
    
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
  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete agent',
      code: 'AGENT_DELETE_ERROR'
    });
  }
});

// Clone agent
router.post('/:agentId/clone', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId } = req.params;
    const { name, description } = req.body;
    
    const clonedAgent = await agentService.cloneAgent(agentId, userId);
    
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
  } catch (error) {
    console.error('❌ Error cloning agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clone agent',
      code: 'AGENT_CLONE_ERROR'
    });
  }
});

// Test agent
router.post('/:agentId/test', authenticateJWT, async (req: any, res) => {
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
    
    const response = await agentService.testAgent(agentId, message);
    
    return res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ Error testing agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test agent',
      code: 'AGENT_TEST_ERROR'
    });
  }
});

// Get agent statistics
router.get('/:agentId/stats', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { agentId } = req.params;
    
    const stats = await agentService.getAgentStats(agentId);
    
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
  } catch (error) {
    console.error('❌ Error getting agent stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent statistics',
      code: 'AGENT_STATS_ERROR'
    });
  }
});

export { router as agentRoutes };