"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const agentController_1 = require("../controllers/agentController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const rateLimit_1 = require("../middleware/rateLimit");
const agentSchema_1 = require("../validation/agentSchema");
const zod_1 = require("zod");
const router = express_1.default.Router();
const agentIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        agentId: zod_1.z.string().min(1, 'Agent ID is required')
    })
});
const agentIdWithLimitSchema = zod_1.z.object({
    params: zod_1.z.object({
        agentId: zod_1.z.string().min(1, 'Agent ID is required'),
        limit: zod_1.z.string().optional()
    })
});
const searchSchema = zod_1.z.object({
    params: zod_1.z.object({
        query: zod_1.z.string().min(1, 'Search query is required')
    })
});
const ratingSchema = zod_1.z.object({
    params: zod_1.z.object({
        agentId: zod_1.z.string().min(1, 'Agent ID is required')
    }),
    body: zod_1.z.object({
        rating: zod_1.z.number().min(0).max(5)
    })
});
router.get('/', auth_1.authenticateJWT, (0, validation_1.validateQuery)(agentSchema_1.agentQuerySchema), (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.getAllAgents));
router.get('/:agentId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.getAgentById));
router.post('/', auth_1.authenticateJWT, rateLimit_1.agentCreationLimiter, (0, validation_1.validateBody)(agentSchema_1.createAgentSchema), (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.createAgent));
router.put('/:agentId', auth_1.authenticateJWT, (0, validation_1.validateBody)(agentSchema_1.updateAgentSchema), (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.updateAgent));
router.delete('/:agentId', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.deleteAgent));
router.get('/templates/all', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.getAgentTemplates));
router.get('/search/:query', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.searchAgents));
router.get('/popular', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.getPopularAgents));
router.get('/popular/:limit', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.getPopularAgents));
router.post('/:agentId/usage', auth_1.authenticateJWT, (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.incrementUsageCount));
router.post('/:agentId/rating', auth_1.authenticateJWT, (0, validation_1.validateBody)(zod_1.z.object({ rating: zod_1.z.number().min(0).max(5) })), (0, errorHandler_1.asyncHandler)(agentController_1.AgentController.updateAgentRating));
exports.default = router;
//# sourceMappingURL=agent.js.map