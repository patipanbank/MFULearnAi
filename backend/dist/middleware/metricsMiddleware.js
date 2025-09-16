"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceTimer = exports.healthEndpoint = exports.metricsEndpoint = exports.websocketMetrics = exports.cacheMetricsWrapper = exports.databaseMetricsWrapper = exports.metricsMiddleware = void 0;
const metricsService_1 = __importDefault(require("../services/metricsService"));
const metricsMiddleware = (req, res, next) => {
    req.startTime = Date.now();
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const originalMethod = req.method;
    const originalUrl = req.url;
    const userAgent = req.get('User-Agent') || 'unknown';
    console.log(`📊 [${req.requestId}] ${originalMethod} ${originalUrl} - Start`);
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - (req.startTime || Date.now());
        const statusCode = res.statusCode;
        metricsService_1.default.recordRequest(duration);
        if (statusCode >= 400) {
            const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
            metricsService_1.default.recordError(errorType);
            console.log(`❌ [${req.requestId}] ${originalMethod} ${originalUrl} - ${statusCode} (${duration}ms) ERROR`);
        }
        else {
            console.log(`✅ [${req.requestId}] ${originalMethod} ${originalUrl} - ${statusCode} (${duration}ms)`);
        }
        recordBusinessMetrics(originalMethod, originalUrl, statusCode, req);
        if (duration > 1000) {
            console.warn(`🐌 Slow request detected: ${originalMethod} ${originalUrl} took ${duration}ms`);
        }
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.metricsMiddleware = metricsMiddleware;
function recordBusinessMetrics(method, url, statusCode, req) {
    if (statusCode >= 400)
        return;
    if (method === 'POST' && url.startsWith('/api/chat') && statusCode === 200) {
        metricsService_1.default.recordBusinessEvent('chat:created');
    }
    if (url.startsWith('/api/auth') || url.startsWith('/api/user')) {
        metricsService_1.default.recordBusinessEvent('user:active');
    }
    if (url.includes('/agent/') || url.includes('/chat/message')) {
        const agentId = extractAgentId(url, req);
        if (agentId) {
            metricsService_1.default.recordBusinessEvent('agent:used', { agentId });
        }
    }
    if (method === 'POST' && url.startsWith('/api/documents')) {
        metricsService_1.default.recordBusinessEvent('document:processed');
    }
    if (url.includes('/search') && method === 'GET') {
        metricsService_1.default.recordBusinessEvent('search:query');
    }
    const toolName = extractToolUsage(url, req);
    if (toolName) {
        metricsService_1.default.recordBusinessEvent('tool:used', { toolName });
    }
}
function extractAgentId(url, req) {
    const urlMatch = url.match(/\/agent\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }
    if (req.body && req.body.agentId) {
        return req.body.agentId;
    }
    return null;
}
function extractToolUsage(url, req) {
    if (url.includes('/search'))
        return 'search';
    if (url.includes('/upload'))
        return 'upload';
    if (url.includes('/translate'))
        return 'translate';
    if (url.includes('/summarize'))
        return 'summarize';
    if (url.includes('/extract'))
        return 'extract';
    if (req.body && req.body.tool) {
        return req.body.tool;
    }
    return null;
}
const databaseMetricsWrapper = (operation) => {
    const startTime = Date.now();
    return operation()
        .then((result) => {
        const duration = Date.now() - startTime;
        metricsService_1.default.recordDatabaseQuery(duration);
        if (duration > 1000) {
            console.warn(`🐌 Slow database query detected: ${duration}ms`);
        }
        return result;
    })
        .catch((error) => {
        const duration = Date.now() - startTime;
        metricsService_1.default.recordDatabaseQuery(duration);
        metricsService_1.default.recordError('database_error');
        throw error;
    });
};
exports.databaseMetricsWrapper = databaseMetricsWrapper;
exports.cacheMetricsWrapper = {
    hit: () => {
        metricsService_1.default.recordCacheHit();
    },
    miss: () => {
        metricsService_1.default.recordCacheMiss();
    }
};
exports.websocketMetrics = {
    onConnection: () => {
        metricsService_1.default.recordWebSocketConnection();
        console.log('📡 WebSocket connection established');
    },
    onDisconnection: (connectionStartTime) => {
        const lifetime = Date.now() - connectionStartTime;
        metricsService_1.default.recordWebSocketDisconnection(lifetime);
        console.log(`📡 WebSocket disconnected after ${lifetime}ms`);
    }
};
const metricsEndpoint = (req, res) => {
    try {
        const format = req.query.format;
        if (format === 'prometheus') {
            res.set('Content-Type', 'text/plain');
            res.send(metricsService_1.default.getPrometheusMetrics());
        }
        else {
            res.json(metricsService_1.default.getAllMetrics());
        }
    }
    catch (error) {
        console.error('Error serving metrics:', error);
        res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
};
exports.metricsEndpoint = metricsEndpoint;
const healthEndpoint = (req, res) => {
    try {
        const healthMetrics = metricsService_1.default.getHealthMetrics();
        const isHealthy = !Array.from(healthMetrics.servicesStatus.values()).includes('down');
        const response = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: healthMetrics.uptime,
            dependencies: healthMetrics.dependencies,
            services: Object.fromEntries(healthMetrics.servicesStatus),
            alerts: healthMetrics.alerts.filter(alert => Date.now() - alert.timestamp.getTime() < 300000),
        };
        res.status(isHealthy ? 200 : 503).json(response);
    }
    catch (error) {
        console.error('Error serving health check:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: 'Failed to retrieve health status',
            timestamp: new Date().toISOString()
        });
    }
};
exports.healthEndpoint = healthEndpoint;
const performanceTimer = (operationName) => {
    const startTime = Date.now();
    return {
        end: () => {
            const duration = Date.now() - startTime;
            console.log(`⏱️ ${operationName} completed in ${duration}ms`);
            if (duration > 5000) {
                console.warn(`🐌 Long operation detected: ${operationName} took ${duration}ms`);
            }
            return duration;
        }
    };
};
exports.performanceTimer = performanceTimer;
exports.default = {
    metricsMiddleware: exports.metricsMiddleware,
    databaseMetricsWrapper: exports.databaseMetricsWrapper,
    cacheMetricsWrapper: exports.cacheMetricsWrapper,
    websocketMetrics: exports.websocketMetrics,
    metricsEndpoint: exports.metricsEndpoint,
    healthEndpoint: exports.healthEndpoint,
    performanceTimer: exports.performanceTimer
};
//# sourceMappingURL=metricsMiddleware.js.map