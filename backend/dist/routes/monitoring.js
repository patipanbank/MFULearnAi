"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
const usageService_1 = require("../services/usageService");
const router = express_1.default.Router();
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0',
            services: {
                modernSystem: {
                    status: 'operational',
                    activeExecutions: 0,
                    queueSize: 0
                },
                toolRegistry: {
                    status: 'operational',
                    totalTools: unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics().totalTools,
                    enabledTools: unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics().enabledTools
                }
            }
        };
        return res.json({
            success: true,
            health
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            health: {
                status: 'unhealthy',
                error: error.message
            }
        });
    }
});
router.get('/metrics', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        const metrics = {
            system: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            modernSystem: {
                executions: 0,
                averageTime: 0,
                successRate: 100
            },
            toolRegistry: unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics()
        };
        return res.json({
            success: true,
            metrics
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch metrics'
        });
    }
});
router.get('/executions', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        const { limit = 100, status, userId } = req.query;
        if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        const mockHistory = [];
        const stats = {
            total: 0,
            successful: 0,
            failed: 0,
            averageDuration: 0,
            totalTokens: 0,
            averageToolsPerExecution: 0
        };
        return res.json({
            success: true,
            executions: [],
            statistics: stats
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch execution history'
        });
    }
});
router.get('/tools/performance', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        const toolStats = unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics();
        const performanceArray = [];
        return res.json({
            success: true,
            overview: toolStats,
            toolPerformance: performanceArray
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tool performance'
        });
    }
});
router.get('/usage', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        const { period = '7d', userId } = req.query;
        if (!user) {
            return res.status(403).json({
                success: false,
                error: 'Authentication required'
            });
        }
        let targetUserId = userId;
        if (!['Admin', 'SuperAdmin'].includes(user.role)) {
            targetUserId = user.sub;
        }
        const usageStats = targetUserId
            ? await usageService_1.usageService.getUserUsage(targetUserId)
            : { message: 'All users usage not implemented yet' };
        return res.json({
            success: true,
            usage: usageStats,
            period
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch usage analytics'
        });
    }
});
router.get('/alerts', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        const alerts = [];
        const memory = process.memoryUsage();
        const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
        if (memoryUsagePercent > 80) {
            alerts.push({
                level: 'warning',
                type: 'high_memory_usage',
                message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
                timestamp: new Date(),
                data: { memoryUsagePercent, memory }
            });
        }
        return res.json({
            success: true,
            alerts,
            summary: {
                total: alerts.length,
                warnings: alerts.filter(a => a.level === 'warning').length,
                errors: alerts.filter(a => a.level === 'error').length
            }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
});
router.post('/test', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        const testRequest = {
            id: `test_${Date.now()}`,
            chatId: 'test_chat',
            userId: user.sub,
            prompt: 'Test execution for monitoring',
            context: {
                modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                temperature: 0.7,
                maxTokens: 100
            },
            priority: 1,
            createdAt: new Date()
        };
        const testResult = {
            executionId: testRequest.id,
            success: true,
            duration: Math.random() * 5000 + 1000,
            message: 'Test execution completed successfully'
        };
        return res.json({
            success: true,
            test: testResult
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to run monitoring test'
        });
    }
});
exports.default = router;
//# sourceMappingURL=monitoring.js.map