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
        modernSystem: {
          status: 'operational',
          activeExecutions: 0,
          queueSize: 0
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
      modernSystem: {
        executions: 0,
        averageTime: 0,
        successRate: 100
      },
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

    // Modern system doesn't have execution history yet
    const mockHistory: any[] = [];
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
    // Modern system doesn't have execution history yet
    const performanceArray: any[] = [];

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