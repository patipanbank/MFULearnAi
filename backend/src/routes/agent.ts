import express from 'express';
import { AgentController } from '../controllers/agentController';
import { authenticateJWT } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { agentCreationLimiter } from '../middleware/rateLimit';
import { 
  createAgentSchema, 
  updateAgentSchema, 
  agentQuerySchema
} from '../validation/agentSchema';
import { z } from 'zod';

const router = express.Router();

// Validation schemas for different endpoints
const agentIdSchema = z.object({
  params: z.object({
    agentId: z.string().min(1, 'Agent ID is required')
  })
});

const agentIdWithLimitSchema = z.object({
  params: z.object({
    agentId: z.string().min(1, 'Agent ID is required'),
    limit: z.string().optional()
  })
});

const searchSchema = z.object({
  params: z.object({
    query: z.string().min(1, 'Search query is required')
  })
});

const ratingSchema = z.object({
  params: z.object({
    agentId: z.string().min(1, 'Agent ID is required')
  }),
  body: z.object({
    rating: z.number().min(0).max(5)
  })
});

// Get all agents (public + user's own) with filtering and pagination
router.get('/', 
  authenticateJWT, 
  validateQuery(agentQuerySchema),
  asyncHandler(AgentController.getAllAgents)
);

// Get agent by ID
router.get('/:agentId', 
  authenticateJWT, 
  asyncHandler(AgentController.getAgentById)
);

// Create new agent (with rate limiting)
router.post('/', 
  authenticateJWT, 
  agentCreationLimiter,
  validateBody(createAgentSchema),
  asyncHandler(AgentController.createAgent)
);

// Update agent
router.put('/:agentId', 
  authenticateJWT, 
  validateBody(updateAgentSchema),
  asyncHandler(AgentController.updateAgent)
);

// Delete agent
router.delete('/:agentId', 
  authenticateJWT, 
  asyncHandler(AgentController.deleteAgent)
);

// Get agent templates
router.get('/templates/all', 
  authenticateJWT, 
  asyncHandler(AgentController.getAgentTemplates)
);

// Search agents
router.get('/search/:query', 
  authenticateJWT, 
  asyncHandler(AgentController.searchAgents)
);

// Get popular agents (default limit 10)
router.get('/popular', 
  authenticateJWT, 
  asyncHandler(AgentController.getPopularAgents)
);

// Get popular agents with custom limit
router.get('/popular/:limit', 
  authenticateJWT, 
  asyncHandler(AgentController.getPopularAgents)
);

// Increment usage count
router.post('/:agentId/usage', 
  authenticateJWT, 
  asyncHandler(AgentController.incrementUsageCount)
);

// Update agent rating
router.post('/:agentId/rating', 
  authenticateJWT, 
  validateBody(z.object({ rating: z.number().min(0).max(5) })),
  asyncHandler(AgentController.updateAgentRating)
);

export default router; 