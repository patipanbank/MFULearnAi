/**
 * Metrics Routes
 * API endpoints for system monitoring and metrics
 */

import { Router } from 'express';
import { metricsEndpoint, healthEndpoint } from '../middleware/metricsMiddleware';
import metricsService from '../services/metricsService';
import { Request, Response } from 'express';

const router = Router();

/**
 * GET /metrics - Get all system metrics
 * Supports both JSON and Prometheus formats
 */
router.get('/metrics', metricsEndpoint);

/**
 * GET /health - System health check
 */
router.get('/health', healthEndpoint);

/**
 * POST /metrics/frontend - Receive frontend metrics
 */
router.post('/metrics/frontend', async (req: Request, res: Response) => {
  try {
    const { metrics, userAgent, url } = req.body;

    // Store frontend metrics (could be sent to analytics service)
    console.log('📊 Frontend metrics received:', {
      url,
      userAgent: userAgent?.substring(0, 50) + '...',
      sessionDuration: metrics.sessionDuration,
      pageLoadTime: metrics.pageLoadTime,
      errorCount: metrics.jsErrors?.length || 0,
      renderPerformance: metrics.averageComponentRenderTime,
    });

    // Record business events from frontend
    if (metrics.messagesPerSession > 0) {
      for (let i = 0; i < metrics.messagesPerSession; i++) {
        metricsService.recordBusinessEvent('user:active');
      }
    }

    // Could integrate with external analytics services here
    // await analyticsService.sendFrontendMetrics(metrics);

    res.json({ success: true, message: 'Frontend metrics recorded' });
  } catch (error) {
    console.error('Error processing frontend metrics:', error);
    res.status(500).json({ error: 'Failed to process frontend metrics' });
  }
});

/**
 * GET /metrics/summary - Get summarized metrics for dashboard
 */
router.get('/metrics/summary', (req: Request, res: Response) => {
  try {
    const summary = metricsService.getAllMetrics();

    // Add additional calculated metrics
    const enhancedSummary = {
      ...summary,
      derived: {
        requestsPerMinute: calculateRequestsPerMinute(),
        systemLoad: calculateSystemLoad(summary),
        alertSeverity: calculateAlertSeverity(summary.health.alerts),
        topErrors: getTopErrors(),
        performanceScore: calculatePerformanceScore(summary),
      }
    };

    res.json(enhancedSummary);
  } catch (error) {
    console.error('Error getting metrics summary:', error);
    res.status(500).json({ error: 'Failed to get metrics summary' });
  }
});

/**
 * GET /metrics/performance/history - Get historical performance data
 */
router.get('/metrics/performance/history', (req: Request, res: Response) => {
  try {
    const { timeRange = '1h', granularity = '5m' } = req.query;

    // This would typically query a time-series database
    // For now, return mock historical data
    const history = generateMockHistoricalData(timeRange as string, granularity as string);

    res.json({
      timeRange,
      granularity,
      data: history
    });
  } catch (error) {
    console.error('Error getting performance history:', error);
    res.status(500).json({ error: 'Failed to get performance history' });
  }
});

/**
 * POST /metrics/alert - Create custom alert
 */
router.post('/metrics/alert', (req: Request, res: Response) => {
  try {
    const { level, message, service } = req.body;

    if (!level || !message || !service) {
      return res.status(400).json({ error: 'Missing required fields: level, message, service' });
    }

    // Add alert to metrics service
    const healthMetrics = metricsService.getHealthMetrics();
    healthMetrics.alerts.unshift({
      level,
      message,
      service,
      timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Alert created successfully' });
  } catch (error) {
    console.error('Error creating alert:', error);
    return res.status(500).json({ error: 'Failed to create alert' });
  }
});

/**
 * GET /metrics/export - Export metrics data
 */
router.get('/metrics/export', (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const metrics = metricsService.getAllMetrics();

    switch (format) {
      case 'prometheus':
        res.set('Content-Type', 'text/plain');
        res.send(metricsService.getPrometheusMetrics());
        break;

      case 'csv':
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', 'attachment; filename=metrics.csv');
        res.send(convertToCSV(metrics));
        break;

      case 'json':
      default:
        res.set('Content-Type', 'application/json');
        res.set('Content-Disposition', 'attachment; filename=metrics.json');
        res.json(metrics);
        break;
    }
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

// Helper functions

function calculateRequestsPerMinute(): number {
  const performanceMetrics = metricsService.getPerformanceMetrics();
  // This is a simplified calculation - in reality you'd track time windows
  return Math.round(performanceMetrics.requestCount / (process.uptime() / 60));
}

function calculateSystemLoad(metrics: any): 'low' | 'medium' | 'high' | 'critical' {
  const memoryUsage = metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal;
  const errorRate = metrics.performance.errorRate;
  const responseTime = metrics.performance.responseTime.p95;

  if (memoryUsage > 0.9 || errorRate > 10 || responseTime > 5000) {
    return 'critical';
  } else if (memoryUsage > 0.7 || errorRate > 5 || responseTime > 2000) {
    return 'high';
  } else if (memoryUsage > 0.5 || errorRate > 2 || responseTime > 1000) {
    return 'medium';
  } else {
    return 'low';
  }
}

function calculateAlertSeverity(alerts: any[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (!alerts.length) return 'none';

  const recentAlerts = alerts.filter(alert =>
    Date.now() - new Date(alert.timestamp).getTime() < 300000 // Last 5 minutes
  );

  const criticalCount = recentAlerts.filter(a => a.level === 'critical').length;
  const errorCount = recentAlerts.filter(a => a.level === 'error').length;
  const warningCount = recentAlerts.filter(a => a.level === 'warning').length;

  if (criticalCount > 0) return 'critical';
  if (errorCount > 2) return 'high';
  if (errorCount > 0 || warningCount > 5) return 'medium';
  if (warningCount > 0) return 'low';
  return 'none';
}

function getTopErrors(): Array<{ type: string; count: number }> {
  const performanceMetrics = metricsService.getPerformanceMetrics();
  return Array.from(performanceMetrics.errorsByType.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function calculatePerformanceScore(metrics: any): number {
  // Calculate a performance score from 0-100
  let score = 100;

  // Deduct points for high error rate
  score -= Math.min(metrics.performance.errorRate * 5, 30);

  // Deduct points for slow response times
  if (metrics.performance.responseTime.p95 > 1000) {
    score -= Math.min((metrics.performance.responseTime.p95 - 1000) / 100, 20);
  }

  // Deduct points for high memory usage
  const memoryUsage = metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal;
  if (memoryUsage > 0.8) {
    score -= (memoryUsage - 0.8) * 100;
  }

  // Deduct points for low cache hit rate
  if (metrics.performance.cacheHitRate < 80) {
    score -= (80 - metrics.performance.cacheHitRate) / 2;
  }

  return Math.max(0, Math.round(score));
}

function generateMockHistoricalData(timeRange: string, granularity: string): any[] {
  // Generate mock historical data for demonstration
  const now = Date.now();
  const intervals = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  const granularityMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
  };

  const totalTime = intervals[timeRange as keyof typeof intervals] || intervals['1h'];
  const stepSize = granularityMs[granularity as keyof typeof granularityMs] || granularityMs['5m'];
  const points = Math.floor(totalTime / stepSize);

  const data = [];
  for (let i = 0; i < points; i++) {
    const timestamp = now - (totalTime - (i * stepSize));
    data.push({
      timestamp: new Date(timestamp).toISOString(),
      responseTime: 200 + Math.random() * 800 + Math.sin(i / 10) * 200,
      requestCount: Math.floor(50 + Math.random() * 100 + Math.sin(i / 5) * 30),
      errorRate: Math.max(0, Math.random() * 5 + Math.sin(i / 8) * 2),
      memoryUsage: 0.4 + Math.random() * 0.3 + Math.sin(i / 15) * 0.1,
      activeConnections: Math.floor(10 + Math.random() * 50 + Math.sin(i / 12) * 20),
    });
  }

  return data;
}

function convertToCSV(data: any): string {
  const flatten = (obj: any, prefix = ''): any => {
    let result: any = {};
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flatten(obj[key], prefix + key + '_'));
      } else if (!Array.isArray(obj[key])) {
        result[prefix + key] = obj[key];
      }
    }
    return result;
  };

  const flattened = flatten(data);
  const headers = Object.keys(flattened);
  const values = Object.values(flattened);

  return headers.join(',') + '\n' + values.join(',');
}

export default router;