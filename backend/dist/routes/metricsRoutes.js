"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metricsMiddleware_1 = require("../middleware/metricsMiddleware");
const metricsService_1 = __importDefault(require("../services/metricsService"));
const router = (0, express_1.Router)();
router.get('/metrics', metricsMiddleware_1.metricsEndpoint);
router.get('/health', metricsMiddleware_1.healthEndpoint);
router.post('/metrics/frontend', async (req, res) => {
    try {
        const { metrics, userAgent, url } = req.body;
        console.log('📊 Frontend metrics received:', {
            url,
            userAgent: userAgent?.substring(0, 50) + '...',
            sessionDuration: metrics.sessionDuration,
            pageLoadTime: metrics.pageLoadTime,
            errorCount: metrics.jsErrors?.length || 0,
            renderPerformance: metrics.averageComponentRenderTime,
        });
        if (metrics.messagesPerSession > 0) {
            for (let i = 0; i < metrics.messagesPerSession; i++) {
                metricsService_1.default.recordBusinessEvent('user:active');
            }
        }
        res.json({ success: true, message: 'Frontend metrics recorded' });
    }
    catch (error) {
        console.error('Error processing frontend metrics:', error);
        res.status(500).json({ error: 'Failed to process frontend metrics' });
    }
});
router.get('/metrics/summary', (req, res) => {
    try {
        const summary = metricsService_1.default.getAllMetrics();
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
    }
    catch (error) {
        console.error('Error getting metrics summary:', error);
        res.status(500).json({ error: 'Failed to get metrics summary' });
    }
});
router.get('/metrics/performance/history', (req, res) => {
    try {
        const { timeRange = '1h', granularity = '5m' } = req.query;
        const history = generateMockHistoricalData(timeRange, granularity);
        res.json({
            timeRange,
            granularity,
            data: history
        });
    }
    catch (error) {
        console.error('Error getting performance history:', error);
        res.status(500).json({ error: 'Failed to get performance history' });
    }
});
router.post('/metrics/alert', (req, res) => {
    try {
        const { level, message, service } = req.body;
        if (!level || !message || !service) {
            return res.status(400).json({ error: 'Missing required fields: level, message, service' });
        }
        const healthMetrics = metricsService_1.default.getHealthMetrics();
        healthMetrics.alerts.unshift({
            level,
            message,
            service,
            timestamp: new Date(),
        });
        return res.json({ success: true, message: 'Alert created successfully' });
    }
    catch (error) {
        console.error('Error creating alert:', error);
        return res.status(500).json({ error: 'Failed to create alert' });
    }
});
router.get('/metrics/export', (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const metrics = metricsService_1.default.getAllMetrics();
        switch (format) {
            case 'prometheus':
                res.set('Content-Type', 'text/plain');
                res.send(metricsService_1.default.getPrometheusMetrics());
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
    }
    catch (error) {
        console.error('Error exporting metrics:', error);
        res.status(500).json({ error: 'Failed to export metrics' });
    }
});
function calculateRequestsPerMinute() {
    const performanceMetrics = metricsService_1.default.getPerformanceMetrics();
    return Math.round(performanceMetrics.requestCount / (process.uptime() / 60));
}
function calculateSystemLoad(metrics) {
    const memoryUsage = metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal;
    const errorRate = metrics.performance.errorRate;
    const responseTime = metrics.performance.responseTime.p95;
    if (memoryUsage > 0.9 || errorRate > 10 || responseTime > 5000) {
        return 'critical';
    }
    else if (memoryUsage > 0.7 || errorRate > 5 || responseTime > 2000) {
        return 'high';
    }
    else if (memoryUsage > 0.5 || errorRate > 2 || responseTime > 1000) {
        return 'medium';
    }
    else {
        return 'low';
    }
}
function calculateAlertSeverity(alerts) {
    if (!alerts.length)
        return 'none';
    const recentAlerts = alerts.filter(alert => Date.now() - new Date(alert.timestamp).getTime() < 300000);
    const criticalCount = recentAlerts.filter(a => a.level === 'critical').length;
    const errorCount = recentAlerts.filter(a => a.level === 'error').length;
    const warningCount = recentAlerts.filter(a => a.level === 'warning').length;
    if (criticalCount > 0)
        return 'critical';
    if (errorCount > 2)
        return 'high';
    if (errorCount > 0 || warningCount > 5)
        return 'medium';
    if (warningCount > 0)
        return 'low';
    return 'none';
}
function getTopErrors() {
    const performanceMetrics = metricsService_1.default.getPerformanceMetrics();
    return Array.from(performanceMetrics.errorsByType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}
function calculatePerformanceScore(metrics) {
    let score = 100;
    score -= Math.min(metrics.performance.errorRate * 5, 30);
    if (metrics.performance.responseTime.p95 > 1000) {
        score -= Math.min((metrics.performance.responseTime.p95 - 1000) / 100, 20);
    }
    const memoryUsage = metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal;
    if (memoryUsage > 0.8) {
        score -= (memoryUsage - 0.8) * 100;
    }
    if (metrics.performance.cacheHitRate < 80) {
        score -= (80 - metrics.performance.cacheHitRate) / 2;
    }
    return Math.max(0, Math.round(score));
}
function generateMockHistoricalData(timeRange, granularity) {
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
    const totalTime = intervals[timeRange] || intervals['1h'];
    const stepSize = granularityMs[granularity] || granularityMs['5m'];
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
function convertToCSV(data) {
    const flatten = (obj, prefix = '') => {
        let result = {};
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(result, flatten(obj[key], prefix + key + '_'));
            }
            else if (!Array.isArray(obj[key])) {
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
exports.default = router;
//# sourceMappingURL=metricsRoutes.js.map