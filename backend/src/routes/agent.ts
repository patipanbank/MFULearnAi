import express from 'express';
import { agentService } from '../services/agentService';
import { advancedToolService } from '../services/advancedToolService';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all agents
router.get('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const agents = await agentService.getAllAgents(userId);
    return res.json(agents);
  } catch (error) {
    console.error('❌ Error getting agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agents'
    });
  }
});

// Get agent by ID
router.get('/:id', authenticateJWT, async (req: any, res) => {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgentById(id);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    return res.json(agent);
  } catch (error) {
    console.error(`❌ Error getting agent ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent'
    });
  }
});

// Create new agent
router.post('/', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const agentData = {
      ...req.body,
      createdBy: userId
    };
    
    const agent = await agentService.createAgent(agentData);
    return res.status(201).json(agent);
  } catch (error) {
    console.error('❌ Error creating agent:', error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create agent'
    });
  }
});

// Update agent
router.put('/:id', authenticateJWT, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub || req.user.id;
    const updates = req.body;
    
    const agent = await agentService.updateAgent(id, updates, userId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found or access denied'
      });
    }
    
    return res.json(agent);
  } catch (error) {
    console.error(`❌ Error updating agent ${req.params.id}:`, error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update agent'
    });
  }
});

// Delete agent
router.delete('/:id', authenticateJWT, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub || req.user.id;
    
    const success = await agentService.deleteAgent(id, userId);
    
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
  } catch (error) {
    console.error(`❌ Error deleting agent ${req.params.id}:`, error);
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
    return res.json(templates);
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
    const userId = req.user.sub || req.user.id;
    const customizations = req.body;
    
    const agent = await agentService.createAgentFromTemplate(templateId, {
      ...customizations,
      createdBy: userId
    });
    
    return res.status(201).json(agent);
  } catch (error) {
    console.error('❌ Error creating agent from template:', error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create agent from template'
    });
  }
});

// Get popular agents
router.get('/popular/:limit?', authenticateJWT, async (req: any, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const agents = await agentService.getPopularAgents(limit);
    return res.json(agents);
  } catch (error) {
    console.error('❌ Error getting popular agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get popular agents'
    });
  }
});

// Search agents
router.get('/search/:query', authenticateJWT, async (req: any, res) => {
  try {
    const { query } = req.params;
    const userId = req.user.sub || req.user.id;
    const agents = await agentService.searchAgents(query, userId);
    return res.json(agents);
  } catch (error) {
    console.error('❌ Error searching agents:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search agents'
    });
  }
});

// Get available tools
router.get('/tools/available', authenticateJWT, async (req: any, res) => {
  try {
    const tools = advancedToolService.getAllTools();
    const toolInfo = tools.map(tool => ({
      name: tool.name,
      description: tool.description
    }));
    
    return res.json(toolInfo);
  } catch (error) {
    console.error('❌ Error getting available tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get available tools'
    });
  }
});

// Get tool by name
router.get('/tools/:name', authenticateJWT, async (req: any, res) => {
  try {
    const { name } = req.params;
    const tool = advancedToolService.getTool(name);
    
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
  } catch (error) {
    console.error(`❌ Error getting tool ${req.params.name}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get tool'
    });
  }
});

// Test agent (for development/testing)
router.post('/:id/test', authenticateJWT, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const agent = await agentService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    // สร้าง test response (ไม่ใช่การ process จริง)
    const testResponse = `Test response from agent "${agent.name}": ${message}`;
    
    return res.json({
      success: true,
      agent: agent.name,
      message: message,
      response: testResponse
    });
  } catch (error) {
    console.error(`❌ Error testing agent ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test agent'
    });
  }
});

// Get agent statistics
router.get('/:id/stats', authenticateJWT, async (req: any, res) => {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgentById(id);
    
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
  } catch (error) {
    console.error(`❌ Error getting agent stats ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get agent statistics'
    });
  }
});

export default router; 