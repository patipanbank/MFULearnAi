/**
 * Metrics Middleware
 * Automatically collects performance metrics from Express requests
 */

import { Request, Response, NextFunction } from 'express';
import metricsService from '../services/metricsService';

interface RequestWithMetrics extends Request {
  startTime?: number;
  requestId?: string;
}

export const metricsMiddleware = (req: RequestWithMetrics, res: Response, next: NextFunction): void => {
  // Record request start time
  req.startTime = Date.now();
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Record request
  const originalMethod = req.method;
  const originalUrl = req.url;
  const userAgent = req.get('User-Agent') || 'unknown';

  console.log(`📊 [${req.requestId}] ${originalMethod} ${originalUrl} - Start`);

  // Override res.end to capture response metrics
  const originalEnd = res.end;

  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    // Calculate request duration
    const duration = Date.now() - (req.startTime || Date.now());
    const statusCode = res.statusCode;

    // Record metrics
    metricsService.recordRequest(duration);

    // Record errors (4xx and 5xx status codes)
    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      metricsService.recordError(errorType);

      console.log(`❌ [${req.requestId}] ${originalMethod} ${originalUrl} - ${statusCode} (${duration}ms) ERROR`);
    } else {
      console.log(`✅ [${req.requestId}] ${originalMethod} ${originalUrl} - ${statusCode} (${duration}ms)`);
    }

    // Record business events based on endpoints
    recordBusinessMetrics(originalMethod, originalUrl, statusCode, req);

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`🐌 Slow request detected: ${originalMethod} ${originalUrl} took ${duration}ms`);
    }

    // Call original end function
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

function recordBusinessMetrics(method: string, url: string, statusCode: number, req: Request): void {
  // Only record successful requests
  if (statusCode >= 400) return;

  // Chat related endpoints
  if (method === 'POST' && url.startsWith('/api/chat') && statusCode === 200) {
    metricsService.recordBusinessEvent('chat:created');
  }

  // User activity
  if (url.startsWith('/api/auth') || url.startsWith('/api/user')) {
    metricsService.recordBusinessEvent('user:active');
  }

  // Agent usage
  if (url.includes('/agent/') || url.includes('/chat/message')) {
    const agentId = extractAgentId(url, req);
    if (agentId) {
      metricsService.recordBusinessEvent('agent:used', { agentId });
    }
  }

  // Document processing
  if (method === 'POST' && url.startsWith('/api/documents')) {
    metricsService.recordBusinessEvent('document:processed');
  }

  // Search queries
  if (url.includes('/search') && method === 'GET') {
    metricsService.recordBusinessEvent('search:query');
  }

  // Tool usage (based on request body or URL patterns)
  const toolName = extractToolUsage(url, req);
  if (toolName) {
    metricsService.recordBusinessEvent('tool:used', { toolName });
  }
}

function extractAgentId(url: string, req: Request): string | null {
  // Extract agent ID from URL or request body
  const urlMatch = url.match(/\/agent\/([a-zA-Z0-9]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check request body for agent ID
  if (req.body && req.body.agentId) {
    return req.body.agentId;
  }

  return null;
}

function extractToolUsage(url: string, req: Request): string | null {
  // Extract tool usage from various endpoints
  if (url.includes('/search')) return 'search';
  if (url.includes('/upload')) return 'upload';
  if (url.includes('/translate')) return 'translate';
  if (url.includes('/summarize')) return 'summarize';
  if (url.includes('/extract')) return 'extract';

  // Check request body for tool usage
  if (req.body && req.body.tool) {
    return req.body.tool;
  }

  return null;
}

/**
 * Middleware for tracking database queries
 */
export const databaseMetricsWrapper = <T>(operation: () => Promise<T>): Promise<T> => {
  const startTime = Date.now();

  return operation()
    .then((result) => {
      const duration = Date.now() - startTime;
      metricsService.recordDatabaseQuery(duration);

      if (duration > 1000) {
        console.warn(`🐌 Slow database query detected: ${duration}ms`);
      }

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      metricsService.recordDatabaseQuery(duration);
      metricsService.recordError('database_error');
      throw error;
    });
};

/**
 * Middleware for tracking cache operations
 */
export const cacheMetricsWrapper = {
  hit: () => {
    metricsService.recordCacheHit();
  },

  miss: () => {
    metricsService.recordCacheMiss();
  }
};

/**
 * Middleware for tracking WebSocket connections
 */
export const websocketMetrics = {
  onConnection: () => {
    metricsService.recordWebSocketConnection();
    console.log('📡 WebSocket connection established');
  },

  onDisconnection: (connectionStartTime: number) => {
    const lifetime = Date.now() - connectionStartTime;
    metricsService.recordWebSocketDisconnection(lifetime);
    console.log(`📡 WebSocket disconnected after ${lifetime}ms`);
  }
};

/**
 * Express middleware for handling metrics endpoint
 */
export const metricsEndpoint = (req: Request, res: Response): void => {
  try {
    const format = req.query.format as string;

    if (format === 'prometheus') {
      res.set('Content-Type', 'text/plain');
      res.send(metricsService.getPrometheusMetrics());
    } else {
      res.json(metricsService.getAllMetrics());
    }
  } catch (error) {
    console.error('Error serving metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
};

/**
 * Express middleware for health check endpoint
 */
export const healthEndpoint = (req: Request, res: Response): void => {
  try {
    const healthMetrics = metricsService.getHealthMetrics();
    const isHealthy = !Array.from(healthMetrics.servicesStatus.values()).includes('down');

    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: healthMetrics.uptime,
      dependencies: healthMetrics.dependencies,
      services: Object.fromEntries(healthMetrics.servicesStatus),
      alerts: healthMetrics.alerts.filter(alert =>
        Date.now() - alert.timestamp.getTime() < 300000 // Last 5 minutes
      ),
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    console.error('Error serving health check:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Failed to retrieve health status',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Performance monitoring for async operations
 */
export const performanceTimer = (operationName: string) => {
  const startTime = Date.now();

  return {
    end: () => {
      const duration = Date.now() - startTime;
      console.log(`⏱️ ${operationName} completed in ${duration}ms`);

      if (duration > 5000) { // 5 seconds
        console.warn(`🐌 Long operation detected: ${operationName} took ${duration}ms`);
      }

      return duration;
    }
  };
};

export default {
  metricsMiddleware,
  databaseMetricsWrapper,
  cacheMetricsWrapper,
  websocketMetrics,
  metricsEndpoint,
  healthEndpoint,
  performanceTimer
};