import express, { Request, Response } from 'express';
import { agentService } from '../services/agentService';

const router = express.Router();

// Simplified auth middleware - assumes JWT is validated by API gateway
const extractUser = (req: any, res: Response, next: Function) => {
  // User info would be passed from API gateway in headers
  req.user = {
    sub: req.headers['x-user-id'] || 'anonymous',
    username: req.headers['x-username'] || 'anonymous',
    role: req.headers['x-user-role'] || 'Students',
    department: req.headers['x-user-department']
  };
  next();
};

// Get all agents (public + user's own)
router.get('/', extractUser, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    let agents = await agentService.getAllAgents(userId);
    if (!Array.isArray(agents)) {
      agents = [];
    }
    return res.json(agents);
  } catch (error) {
    console.error('Error getting agents:', error);
    return res.status(500).json([]);
  }
});

// Get agent by ID
router.get('/:agentId', extractUser, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentService.getAgentById(agentId);

    if (!agent) {
      return res.status(404).json(null);
    }

    return res.json(agent);
  } catch (error) {
    console.error('Error getting agent:', error);
    return res.status(500).json(null);
  }
});

// Create new agent
router.post('/', extractUser, async (req: any, res) => {
  try {
    const userId = req.user.sub;
    const agentData = {
      ...req.body,
      createdBy: userId
    };

    const agent = await agentService.createAgent(agentData, req.user);

    return res.status(201).json(agent);
  } catch (error) {
    console.error('Error creating agent:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Update agent
router.put('/:agentId', extractUser, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.sub;
    const updates = req.body;

    const agent = await agentService.updateAgent(agentId, updates, userId);

    if (!agent) {
      return res.status(404).json(null);
    }

    return res.json(agent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Delete agent
router.delete('/:agentId', extractUser, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.sub;

    const success = await agentService.deleteAgent(agentId, userId);

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
    console.error('Error deleting agent:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete agent'
    });
  }
});

// Get agent templates
router.get('/templates/all', extractUser, async (req: any, res) => {
  try {
    let templates = await agentService.getAgentTemplates();
    if (!Array.isArray(templates)) {
      templates = [];
    }
    return res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting agent templates:', error);
    return res.status(500).json({
      success: false,
      data: [],
      error: 'Failed to get agent templates'
    });
  }
});

// Create agent from template
router.post('/templates/:templateId', extractUser, async (req: any, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.sub;
    const customizations = {
      ...req.body,
      createdBy: userId
    };

    const agent = await agentService.createAgentFromTemplate(templateId, customizations);

    return res.status(201).json(agent);
  } catch (error) {
    console.error('Error creating agent from template:', error);
    return res.status(500).json(null);
  }
});

// Get available tools
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const availableTools = agentService.getAvailableTools();

    return res.json({
      success: true,
      tools: availableTools
    });
  } catch (error) {
    console.error('Error fetching available tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch available tools'
    });
  }
});

// Get tool statistics
router.get('/tools/statistics', extractUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Only allow admin users to see tool statistics
    if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const statistics = agentService.getToolStatistics();

    return res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Error fetching tool statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tool statistics'
    });
  }
});

export default router;
