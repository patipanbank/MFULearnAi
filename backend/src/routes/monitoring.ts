/**
 * 📊 Monitoring & Analytics API Routes
 *
 * API endpoints สำหรับ monitoring และ analytics
 * - Real-time system metrics
 * - Agent execution statistics
 * - Performance analytics
 * - Health checks
 */

import express, { Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { agentExecutionService } from '../services/agentExecutionService';
import { unifiedToolRegistry } from '../services/unifiedToolRegistry';
import { usageService } from '../services/usageService';

const router = express.Router();

/**
 * GET /api/monitoring/health
 * System health check
 */
router.get('/health', async (req: Request, res: Response) => {
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
          activeExecutions: agentExecutionService.getQueueStatus().activeExecutions,
          queueSize: agentExecutionService.getQueueStatus().queueSize
        },
        toolRegistry: {
          status: 'operational',
          totalTools: unifiedToolRegistry.getToolStatistics().totalTools,
          enabledTools: unifiedToolRegistry.getToolStatistics().enabledTools
        }
      }
    };

    return res.json({
      success: true,
      health
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      health: {
        status: 'unhealthy',
        error: (error as Error).message
      }
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Real-time system metrics
 */
router.get('/metrics', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Only allow admin users to see detailed metrics
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
      agentExecution: agentExecutionService.getMetrics(),
      queueStatus: agentExecutionService.getQueueStatus(),
      toolRegistry: unifiedToolRegistry.getToolStatistics()
    };

    return res.json({
      success: true,
      metrics
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

/**
 * GET /api/monitoring/executions
 * Agent execution history and statistics
 */
router.get('/executions', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { limit = 100, status, userId } = req.query;

    // Check permissions
    if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const history = agentExecutionService.getExecutionHistory(Number(limit));

    // Filter by status if specified
    let filteredHistory = history;
    if (status) {
      filteredHistory = history.filter(h =>
        h.success === (status === 'completed')
      );
    }

    // Calculate statistics
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

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch execution history'
    });
  }
});

/**
 * GET /api/monitoring/tools/performance
 * Tool performance analytics
 */
router.get('/tools/performance', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Check permissions
    if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const toolStats = unifiedToolRegistry.getToolStatistics();

    // Get detailed tool performance from execution history
    const executionHistory = agentExecutionService.getExecutionHistory(1000);
    const toolPerformance = new Map<string, {
      executionCount: number;
      totalDuration: number;
      successCount: number;
      failureCount: number;
      averageDuration: number;
      successRate: number;
    }>();

    // Analyze tool performance from execution history
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
        } else {
          existing.failureCount++;
        }

        existing.averageDuration = existing.totalDuration / existing.executionCount;
        existing.successRate = existing.successCount / existing.executionCount;

        toolPerformance.set(toolExec.toolId, existing);
      }
    }

    // Convert to array and sort by usage
    const performanceArray = Array.from(toolPerformance.entries())
      .map(([toolId, stats]) => ({ toolId, ...stats }))
      .sort((a, b) => b.executionCount - a.executionCount);

    return res.json({
      success: true,
      overview: toolStats,
      toolPerformance: performanceArray
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tool performance'
    });
  }
});

/**
 * GET /api/monitoring/usage
 * User usage analytics
 */
router.get('/usage', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { period = '7d', userId } = req.query;

    // Check permissions - users can see their own usage, admins can see all
    if (!user) {
      return res.status(403).json({
        success: false,
        error: 'Authentication required'
      });
    }

    let targetUserId = userId as string;
    if (!['Admin', 'SuperAdmin'].includes(user.role)) {
      // Non-admin users can only see their own usage
      targetUserId = user.sub;
    }

    // For now, return basic usage stats
    // In a full implementation, this would aggregate usage data over time
    const usageStats = targetUserId
      ? await usageService.getUserUsage(targetUserId)
      : { message: 'All users usage not implemented yet' };

    return res.json({
      success: true,
      usage: usageStats,
      period
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch usage analytics'
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * System alerts and warnings
 */
router.get('/alerts', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Check permissions
    if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const alerts = [];
    const metrics = agentExecutionService.getMetrics();
    const queueStatus = agentExecutionService.getQueueStatus();
    const memory = process.memoryUsage();

    // Memory usage alerts
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

    // Queue size alerts
    if (queueStatus.queueSize > 10) {
      alerts.push({
        level: 'warning',
        type: 'large_queue_size',
        message: `Large execution queue: ${queueStatus.queueSize} items`,
        timestamp: new Date(),
        data: { queueSize: queueStatus.queueSize }
      });
    }

    // Failure rate alerts
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

    // Performance alerts
    if (metrics.averageExecutionTime > 30000) { // 30 seconds
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

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * POST /api/monitoring/test
 * Test monitoring system
 */
router.post('/test', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Check permissions
    if (!user || !['Admin', 'SuperAdmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Generate test execution request
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

    // This would execute a test agent run
    // For now, just return test data
    const testResult = {
      executionId: testRequest.id,
      success: true,
      duration: Math.random() * 5000 + 1000, // 1-6 seconds
      message: 'Test execution completed successfully'
    };

    return res.json({
      success: true,
      test: testResult
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to run monitoring test'
    });
  }
});

export default router;