"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class MetricsService extends events_1.EventEmitter {
    constructor() {
        super();
        this.metricsInterval = null;
        this.healthCheckInterval = null;
        this.requestTimes = [];
        this.connectionLifetimes = [];
        this.queryTimes = [];
        this.MAX_SAMPLES = 1000;
        this.METRICS_INTERVAL = 30000;
        this.HEALTH_CHECK_INTERVAL = 60000;
        this.initializeMetrics();
        this.startMetricsCollection();
        this.startHealthChecks();
    }
    initializeMetrics() {
        this.performanceMetrics = {
            requestCount: 0,
            requestDuration: [],
            responseTime: { min: 0, max: 0, avg: 0, p95: 0, p99: 0 },
            errorCount: 0,
            errorRate: 0,
            errorsByType: new Map(),
            activeConnections: 0,
            messagesPerSecond: 0,
            connectionLifetime: [],
            dbQueryCount: 0,
            dbQueryDuration: [],
            dbConnectionPool: { active: 0, idle: 0, pending: 0 },
            memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
            cpuUsage: 0,
            cacheHitRate: 0,
            cacheMissRate: 0,
            cacheSize: 0,
        };
        this.businessMetrics = {
            activeUsers: 0,
            newUsersToday: 0,
            userSessions: 0,
            totalChats: 0,
            newChatsToday: 0,
            messagesPerChat: 0,
            avgChatDuration: 0,
            agentUsage: new Map(),
            toolUsage: new Map(),
            documentsProcessed: 0,
            embeddings: 0,
            searchQueries: 0,
            apiCallsPerHour: 0,
            peakConcurrentUsers: 0,
            storageUsed: 0,
        };
        this.healthMetrics = {
            uptime: 0,
            lastHealthCheck: new Date(),
            servicesStatus: new Map(),
            dependencies: {
                mongodb: false,
                redis: false,
                chroma: false,
                minio: false,
                aws: false,
            },
            alerts: [],
        };
    }
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.collectSystemMetrics();
            this.calculateDerivedMetrics();
            this.emit('metrics:collected', {
                performance: this.performanceMetrics,
                business: this.businessMetrics,
                health: this.healthMetrics,
            });
        }, this.METRICS_INTERVAL);
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.HEALTH_CHECK_INTERVAL);
    }
    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.performanceMetrics.memoryUsage = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
        };
        const cpuUsage = process.cpuUsage();
        this.performanceMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000;
        this.healthMetrics.uptime = process.uptime();
    }
    calculateDerivedMetrics() {
        if (this.requestTimes.length > 0) {
            const sorted = [...this.requestTimes].sort((a, b) => a - b);
            const len = sorted.length;
            this.performanceMetrics.responseTime = {
                min: sorted[0],
                max: sorted[len - 1],
                avg: sorted.reduce((a, b) => a + b, 0) / len,
                p95: sorted[Math.floor(len * 0.95)],
                p99: sorted[Math.floor(len * 0.99)],
            };
        }
        const totalRequests = this.performanceMetrics.requestCount;
        this.performanceMetrics.errorRate = totalRequests > 0
            ? (this.performanceMetrics.errorCount / totalRequests) * 100
            : 0;
        const totalCacheRequests = this.performanceMetrics.cacheHitRate + this.performanceMetrics.cacheMissRate;
        if (totalCacheRequests > 0) {
            this.performanceMetrics.cacheHitRate = (this.performanceMetrics.cacheHitRate / totalCacheRequests) * 100;
        }
        this.cleanupSamples();
    }
    cleanupSamples() {
        if (this.requestTimes.length > this.MAX_SAMPLES) {
            this.requestTimes = this.requestTimes.slice(-this.MAX_SAMPLES);
        }
        if (this.connectionLifetimes.length > this.MAX_SAMPLES) {
            this.connectionLifetimes = this.connectionLifetimes.slice(-this.MAX_SAMPLES);
        }
        if (this.queryTimes.length > this.MAX_SAMPLES) {
            this.queryTimes = this.queryTimes.slice(-this.MAX_SAMPLES);
        }
    }
    async performHealthCheck() {
        this.healthMetrics.lastHealthCheck = new Date();
        await this.checkDependencies();
        this.updateServiceStatus();
        this.generateAlerts();
        this.emit('health:checked', this.healthMetrics);
    }
    async checkDependencies() {
        try {
            this.healthMetrics.dependencies.mongodb = await this.checkMongoDB();
            this.healthMetrics.dependencies.redis = await this.checkRedis();
            this.healthMetrics.dependencies.chroma = await this.checkChroma();
            this.healthMetrics.dependencies.minio = await this.checkMinIO();
            this.healthMetrics.dependencies.aws = await this.checkAWS();
        }
        catch (error) {
            console.error('Health check failed:', error);
        }
    }
    async checkMongoDB() {
        try {
            return true;
        }
        catch {
            return false;
        }
    }
    async checkRedis() {
        try {
            return true;
        }
        catch {
            return false;
        }
    }
    async checkChroma() {
        try {
            return true;
        }
        catch {
            return false;
        }
    }
    async checkMinIO() {
        try {
            return true;
        }
        catch {
            return false;
        }
    }
    async checkAWS() {
        try {
            return true;
        }
        catch {
            return false;
        }
    }
    updateServiceStatus() {
        const allDependenciesHealthy = Object.values(this.healthMetrics.dependencies).every(status => status);
        const errorRate = this.performanceMetrics.errorRate;
        const memoryUsage = this.performanceMetrics.memoryUsage.heapUsed / this.performanceMetrics.memoryUsage.heapTotal;
        if (!allDependenciesHealthy || errorRate > 5) {
            this.healthMetrics.servicesStatus.set('system', 'down');
        }
        else if (errorRate > 1 || memoryUsage > 0.9) {
            this.healthMetrics.servicesStatus.set('system', 'degraded');
        }
        else {
            this.healthMetrics.servicesStatus.set('system', 'healthy');
        }
    }
    generateAlerts() {
        const alerts = [];
        if (this.performanceMetrics.errorRate > 5) {
            alerts.push({
                level: 'critical',
                message: `High error rate detected: ${this.performanceMetrics.errorRate.toFixed(2)}%`,
                timestamp: new Date(),
                service: 'api',
            });
        }
        const memoryUsage = this.performanceMetrics.memoryUsage.heapUsed / this.performanceMetrics.memoryUsage.heapTotal;
        if (memoryUsage > 0.9) {
            alerts.push({
                level: 'warning',
                message: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
                timestamp: new Date(),
                service: 'system',
            });
        }
        if (this.performanceMetrics.responseTime.p95 > 2000) {
            alerts.push({
                level: 'warning',
                message: `Slow response times: P95 = ${this.performanceMetrics.responseTime.p95}ms`,
                timestamp: new Date(),
                service: 'api',
            });
        }
        Object.entries(this.healthMetrics.dependencies).forEach(([service, healthy]) => {
            if (!healthy) {
                alerts.push({
                    level: 'critical',
                    message: `Service dependency down: ${service}`,
                    timestamp: new Date(),
                    service,
                });
            }
        });
        this.healthMetrics.alerts = [...alerts, ...this.healthMetrics.alerts].slice(0, 100);
    }
    recordRequest(duration) {
        this.performanceMetrics.requestCount++;
        this.requestTimes.push(duration);
    }
    recordError(errorType) {
        this.performanceMetrics.errorCount++;
        const current = this.performanceMetrics.errorsByType.get(errorType) || 0;
        this.performanceMetrics.errorsByType.set(errorType, current + 1);
    }
    recordWebSocketConnection() {
        this.performanceMetrics.activeConnections++;
    }
    recordWebSocketDisconnection(lifetime) {
        this.performanceMetrics.activeConnections = Math.max(0, this.performanceMetrics.activeConnections - 1);
        this.connectionLifetimes.push(lifetime);
    }
    recordDatabaseQuery(duration) {
        this.performanceMetrics.dbQueryCount++;
        this.queryTimes.push(duration);
    }
    recordCacheHit() {
        this.performanceMetrics.cacheHitRate++;
    }
    recordCacheMiss() {
        this.performanceMetrics.cacheMissRate++;
    }
    recordBusinessEvent(event, data) {
        switch (event) {
            case 'user:active':
                this.businessMetrics.activeUsers++;
                break;
            case 'user:new':
                this.businessMetrics.newUsersToday++;
                break;
            case 'chat:created':
                this.businessMetrics.newChatsToday++;
                this.businessMetrics.totalChats++;
                break;
            case 'agent:used':
                if (data?.agentId) {
                    const current = this.businessMetrics.agentUsage.get(data.agentId) || 0;
                    this.businessMetrics.agentUsage.set(data.agentId, current + 1);
                }
                break;
            case 'tool:used':
                if (data?.toolName) {
                    const current = this.businessMetrics.toolUsage.get(data.toolName) || 0;
                    this.businessMetrics.toolUsage.set(data.toolName, current + 1);
                }
                break;
            case 'document:processed':
                this.businessMetrics.documentsProcessed++;
                break;
            case 'search:query':
                this.businessMetrics.searchQueries++;
                break;
        }
    }
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    getBusinessMetrics() {
        return { ...this.businessMetrics };
    }
    getHealthMetrics() {
        return { ...this.healthMetrics };
    }
    getAllMetrics() {
        return {
            performance: this.getPerformanceMetrics(),
            business: this.getBusinessMetrics(),
            health: this.getHealthMetrics(),
            timestamp: new Date(),
        };
    }
    getPrometheusMetrics() {
        const metrics = this.getAllMetrics();
        return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.performance.requestCount}

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} ${this.requestTimes.filter(t => t <= 100).length}
http_request_duration_seconds_bucket{le="0.5"} ${this.requestTimes.filter(t => t <= 500).length}
http_request_duration_seconds_bucket{le="1.0"} ${this.requestTimes.filter(t => t <= 1000).length}
http_request_duration_seconds_bucket{le="2.0"} ${this.requestTimes.filter(t => t <= 2000).length}
http_request_duration_seconds_bucket{le="+Inf"} ${this.requestTimes.length}

# HELP http_errors_total Total number of HTTP errors
# TYPE http_errors_total counter
http_errors_total ${metrics.performance.errorCount}

# HELP websocket_connections_active Current active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active ${metrics.performance.activeConnections}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes{type="heap_used"} ${metrics.performance.memoryUsage.heapUsed}
memory_usage_bytes{type="heap_total"} ${metrics.performance.memoryUsage.heapTotal}
memory_usage_bytes{type="rss"} ${metrics.performance.memoryUsage.rss}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${metrics.health.uptime}

# HELP active_users_total Current active users
# TYPE active_users_total gauge
active_users_total ${metrics.business.activeUsers}

# HELP chats_created_today_total Chats created today
# TYPE chats_created_today_total counter
chats_created_today_total ${metrics.business.newChatsToday}
    `.trim();
    }
    destroy() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.removeAllListeners();
    }
}
exports.default = new MetricsService();
//# sourceMappingURL=metricsService.js.map