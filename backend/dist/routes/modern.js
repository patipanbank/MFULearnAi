"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const modernSystemIntegration_1 = require("../core/modernSystemIntegration");
const router = express_1.default.Router();
router.post('/chat', auth_1.authenticateJWT, async (req, res) => {
    await modernSystemIntegration_1.modernSystemIntegration.handleChatMessage(req, res);
});
router.get('/health', async (req, res) => {
    try {
        const healthCheck = await modernSystemIntegration_1.modernSystemIntegration.healthCheck();
        res.json(healthCheck);
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            system: 'modern',
            error: error.message
        });
    }
});
router.get('/benchmark', async (req, res) => {
    try {
        const benchmark = await modernSystemIntegration_1.modernSystemIntegration.runBenchmark();
        res.json(benchmark);
    }
    catch (error) {
        res.status(500).json({
            system: 'modern',
            error: error.message,
            benchmark: 'failed'
        });
    }
});
router.post('/test-knowledge', async (req, res) => {
    try {
        const { query, collections } = req.body;
        if (!query || !collections || !Array.isArray(collections)) {
            return res.status(400).json({
                error: 'Missing required fields: query (string), collections (array)'
            });
        }
        const testResult = await modernSystemIntegration_1.modernSystemIntegration.testKnowledgeRetrieval(query, collections);
        return res.json(testResult);
    }
    catch (error) {
        return res.status(500).json({
            error: 'Knowledge retrieval test failed',
            details: error.message
        });
    }
});
router.get('/status', (req, res) => {
    const status = modernSystemIntegration_1.modernSystemIntegration.getStatus();
    return res.json(status);
});
router.post('/enable', auth_1.authenticateJWT, (req, res) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                error: 'enabled field must be a boolean'
            });
        }
        modernSystemIntegration_1.modernSystemIntegration.setEnabled(enabled);
        return res.json({
            success: true,
            enabled,
            message: `Modern system ${enabled ? 'enabled' : 'disabled'}`
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to set modern system status',
            details: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=modern.js.map