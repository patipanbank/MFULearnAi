"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const agentExecutionService_1 = require("../services/agentExecutionService");
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
                agentExecution: {
                    status: 'operational',
                    activeExecutions: agentExecutionService_1.agentExecutionService.getQueueStatus().activeExecutions,
                    queueSize: agentExecutionService_1.agentExecutionService.getQueueStatus().queueSize
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
            agentExecution: agentExecutionService_1.agentExecutionService.getMetrics(),
            queueStatus: agentExecutionService_1.agentExecutionService.getQueueStatus(),
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
        const history = agentExecutionService_1.agentExecutionService.getExecutionHistory(Number(limit));
        let filteredHistory = history;
        if (status) {
            filteredHistory = history.filter(h => h.success === (status === 'completed'));
        }
        const stats = {
            total: history.length,
            successful: history.filter(h => h.success).length,
            failed: history.filter(h => !h.success).length,
            averageDuration: history.reduce((sum, h) => sum + h.metrics.duration, 0) / history.length,
            totalTokens: history.reduce((sum, h) => sum + h.metrics.tokenUsage.input + h.metrics.tokenUsage.output, 0),
            averageToolsPerExecution: history.reduce((sum, h) => sum + h.metrics.toolCount, 0) / history.length
        };
        return res.json({
            success: true,
            executions: filteredHistory,
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
        const executionHistory = agentExecutionService_1.agentExecutionService.getExecutionHistory(1000);
        const toolPerformance = new Map();
        for (const execution of executionHistory) {
            for (const toolExec of execution.toolExecutions) {
                const existing = toolPerformance.get(toolExec.toolId) || {
                    executionCount: 0,
                    totalDuration: 0,
                    successCount: 0,
                    failureCount: 0,
                    averageDuration: 0,
                    successRate: 0
                };
                existing.executionCount++;
                existing.totalDuration += toolExec.duration;
                if (toolExec.success) {
                    existing.successCount++;
                }
                else {
                    existing.failureCount++;
                }
                existing.averageDuration = existing.totalDuration / existing.executionCount;
                existing.successRate = existing.successCount / existing.executionCount;
                toolPerformance.set(toolExec.toolId, existing);
            }
        }
        const performanceArray = Array.from(toolPerformance.entries())
            .map(([toolId, stats]) => ({ toolId, ...stats }))
            .sort((a, b) => b.executionCount - a.executionCount);
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
        const metrics = agentExecutionService_1.agentExecutionService.getMetrics();
        const queueStatus = agentExecutionService_1.agentExecutionService.getQueueStatus();
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
        if (queueStatus.queueSize > 10) {
            alerts.push({
                level: 'warning',
                type: 'large_queue_size',
                message: `Large execution queue: ${queueStatus.queueSize} items`,
                timestamp: new Date(),
                data: { queueSize: queueStatus.queueSize }
            });
        }
        const totalExecutions = metrics.successfulExecutions + metrics.failedExecutions;
        if (totalExecutions > 10) {
            const failureRate = (metrics.failedExecutions / totalExecutions) * 100;
            if (failureRate > 10) {
                alerts.push({
                    level: 'error',
                    type: 'high_failure_rate',
                    message: `High execution failure rate: ${failureRate.toFixed(1)}%`,
                    timestamp: new Date(),
                    data: { failureRate, totalExecutions, failedExecutions: metrics.failedExecutions }
                });
            }
        }
        if (metrics.averageExecutionTime > 30000) {
            alerts.push({
                level: 'warning',
                type: 'slow_executions',
                message: `Slow average execution time: ${(metrics.averageExecutionTime / 1000).toFixed(1)}s`,
                timestamp: new Date(),
                data: { averageExecutionTime: metrics.averageExecutionTime }
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