import express from 'express';
import { agentService } from '../services/agentService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all agents (public + user's own)
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const agents = await agentService.getAllAgents(userId);
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('❌ Error getting agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agents'
    });
  }
});

// Get agent by ID
router.get('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentService.getAgentById(agentId);
    
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
  } catch (error) {
    console.error('❌ Error getting agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent'
    });
  }
});

// Create new agent
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const agentData = {
      ...req.body,
      createdBy: userId
    };
    
    const agent = await agentService.createAgent(agentData);
    
    return res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('❌ Error creating agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create agent'
    });
  }
});

// Update agent
router.put('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    
    // Check if user owns this agent or if it's public
    const existingAgent = await agentService.getAgentById(agentId);
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
    
    const agent = await agentService.updateAgent(agentId, updates);
    
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
  } catch (error) {
    console.error('❌ Error updating agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update agent'
    });
  }
});

// Delete agent
router.delete('/:agentId', authenticateJWT, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;
    
    // Check if user owns this agent
    const existingAgent = await agentService.getAgentById(agentId);
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
    
    const success = await agentService.deleteAgent(agentId);
    
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
  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete agent'
    });
  }
});

// Get agent templates
router.get('/templates/all', authenticateJWT, async (req: any, res) => {
  try {
    const templates = await agentService.getAgentTemplates();
    
    return res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('❌ Error getting agent templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent templates'
    });
  }
});

// Create agent from template
router.post('/templates/:templateId', authenticateJWT, async (req: any, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const customizations = {
      ...req.body,
      createdBy: userId
    };
    
    const agent = await agentService.createAgentFromTemplate(templateId, customizations);
    
    return res.status(201).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('❌ Error creating agent from template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create agent from template'
    });
  }
});

// Search agents
router.get('/search/:query', authenticateJWT, async (req: any, res) => {
  try {
    const { query } = req.params;
    const userId = req.user.id;
    const agents = await agentService.searchAgents(query, userId);
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('❌ Error searching agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search agents'
    });
  }
});

// Get popular agents
router.get('/popular/:limit?', authenticateJWT, async (req: any, res) => {
  try {
    const limit = req.params.limit ? parseInt(req.params.limit) : 10;
    const agents = await agentService.getPopularAgents(limit);
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('❌ Error getting popular agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get popular agents'
    });
  }
});

// Rate an agent
router.post('/:agentId/rate', authenticateJWT, async (req: any, res) => {
  try {
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
      message: 'Rating updated successfully'
    });
  } catch (error) {
    console.error('❌ Error rating agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to rate agent'
    });
  }
});

export default router; 