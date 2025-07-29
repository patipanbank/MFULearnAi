"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const redis_1 = require("../lib/redis");
const logger_1 = require("../utils/logger");
class AnalyticsService {
    constructor() {
        this.redis = (0, redis_1.getRedis)();
        console.log('✅ Analytics service initialized');
    }
    async trackUserActivity(userId, action, metadata) {
        try {
            const event = {
                type: 'user_activity',
                userId,
                metadata: { action, ...metadata },
                timestamp: new Date()
            };
            await this.redis.lpush('analytics:user_activity', JSON.stringify(event));
            await this.redis.expire('analytics:user_activity', 86400 * 7);
            await this.redis.sadd('analytics:active_users', userId);
            await this.redis.expire('analytics:active_users', 3600);
            (0, logger_1.logInfo)(`User activity tracked: ${action}`, { userId, action, metadata });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to track user activity', error, { userId, action });
        }
    }
    async trackAgentUsage(agentId, userId, duration, metadata) {
        try {
            const event = {
                type: 'agent_usage',
                agentId,
                userId,
                duration,
                metadata,
                timestamp: new Date()
            };
            await this.redis.lpush('analytics:agent_usage', JSON.stringify(event));
            await this.redis.expire('analytics:agent_usage', 86400 * 30);
            await this.redis.hincrby('analytics:agent_stats', agentId, 1);
            await this.redis.expire('analytics:agent_stats', 86400 * 30);
            (0, logger_1.logAgentEvent)('usage', { agentId, userId, duration, metadata });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to track agent usage', error, { agentId, userId });
        }
    }
    async trackToolUsage(toolName, userId, input, output, duration) {
        try {
            const event = {
                type: 'tool_usage',
                userId,
                toolName,
                duration,
                metadata: { input, output },
                timestamp: new Date()
            };
            await this.redis.lpush('analytics:tool_usage', JSON.stringify(event));
            await this.redis.expire('analytics:tool_usage', 86400 * 30);
            await this.redis.hincrby('analytics:tool_stats', toolName, 1);
            await this.redis.expire('analytics:tool_stats', 86400 * 30);
            (0, logger_1.logToolUsage)(toolName, input, output, duration);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to track tool usage', error, { toolName, userId });
        }
    }
    async trackChatEvent(chatId, userId, eventType, metadata) {
        try {
            const event = {
                type: 'chat_event',
                chatId,
                userId,
                metadata: { eventType, ...metadata },
                timestamp: new Date()
            };
            await this.redis.lpush('analytics:chat_events', JSON.stringify(event));
            await this.redis.expire('analytics:chat_events', 86400 * 7);
            (0, logger_1.logInfo)(`Chat event tracked: ${eventType}`, { chatId, userId, eventType, metadata });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to track chat event', error, { chatId, userId, eventType });
        }
    }
    async trackPerformance(operation, duration, metadata) {
        try {
            const event = {
                type: 'performance',
                duration,
                metadata: { operation, ...metadata },
                timestamp: new Date()
            };
            await this.redis.lpush('analytics:performance', JSON.stringify(event));
            await this.redis.expire('analytics:performance', 86400 * 7);
            (0, logger_1.logPerformance)(operation, duration, metadata);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to track performance', error, { operation, duration });
        }
    }
    async getAnalytics(timeRange = '24h') {
        try {
            const now = Date.now();
            let cutoff;
            switch (timeRange) {
                case '1h':
                    cutoff = now - 3600000;
                    break;
                case '24h':
                    cutoff = now - 86400000;
                    break;
                case '7d':
                    cutoff = now - 604800000;
                    break;
                case '30d':
                    cutoff = now - 2592000000;
                    break;
                default:
                    cutoff = now - 86400000;
            }
            const userActivity = await this.getRecentEvents('analytics:user_activity', cutoff);
            const agentUsage = await this.getRecentEvents('analytics:agent_usage', cutoff);
            const toolUsage = await this.getRecentEvents('analytics:tool_usage', cutoff);
            const chatEvents = await this.getRecentEvents('analytics:chat_events', cutoff);
            const performance = await this.getRecentEvents('analytics:performance', cutoff);
            const agentStats = await this.redis.hgetall('analytics:agent_stats');
            const toolStats = await this.redis.hgetall('analytics:tool_stats');
            const activeUsers = await this.redis.scard('analytics:active_users');
            return {
                timeRange,
                events: {
                    userActivity: userActivity.length,
                    agentUsage: agentUsage.length,
                    toolUsage: toolUsage.length,
                    chatEvents: chatEvents.length,
                    performance: performance.length
                },
                stats: {
                    agentStats,
                    toolStats,
                    activeUsers
                },
                recentEvents: {
                    userActivity: userActivity.slice(0, 10),
                    agentUsage: agentUsage.slice(0, 10),
                    toolUsage: toolUsage.slice(0, 10),
                    chatEvents: chatEvents.slice(0, 10),
                    performance: performance.slice(0, 10)
                }
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get analytics', error);
            return null;
        }
    }
    async getPerformanceMetrics() {
        try {
            const performanceEvents = await this.getRecentEvents('analytics:performance', Date.now() - 86400000);
            if (performanceEvents.length === 0) {
                return {
                    totalRequests: 0,
                    averageResponseTime: 0,
                    errorRate: 0,
                    activeUsers: 0,
                    agentUsage: {},
                    toolUsage: {}
                };
            }
            const totalRequests = performanceEvents.length;
            const totalDuration = performanceEvents.reduce((sum, event) => sum + (event.duration || 0), 0);
            const averageResponseTime = totalDuration / totalRequests;
            const errorEvents = performanceEvents.filter(event => event.metadata?.error);
            const errorRate = (errorEvents.length / totalRequests) * 100;
            const activeUsers = await this.redis.scard('analytics:active_users');
            const agentStats = await this.redis.hgetall('analytics:agent_stats');
            const toolStats = await this.redis.hgetall('analytics:tool_stats');
            return {
                totalRequests,
                averageResponseTime,
                errorRate,
                activeUsers,
                agentUsage: agentStats,
                toolUsage: toolStats
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get performance metrics', error);
            return null;
        }
    }
    async getRecentEvents(key, cutoff) {
        try {
            const events = await this.redis.lrange(key, 0, -1);
            return events
                .map(event => JSON.parse(event))
                .filter(event => new Date(event.timestamp).getTime() > cutoff)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        catch (error) {
            (0, logger_1.logError)(`Failed to get recent events for ${key}`, error);
            return [];
        }
    }
    async cleanupOldData() {
        try {
            const keys = [
                'analytics:user_activity',
                'analytics:agent_usage',
                'analytics:tool_usage',
                'analytics:chat_events',
                'analytics:performance'
            ];
            for (const key of keys) {
                const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const events = await this.getRecentEvents(key, cutoff);
                await this.redis.del(key);
                if (events.length > 0) {
                    await this.redis.lpush(key, ...events.map(event => JSON.stringify(event)));
                    await this.redis.expire(key, 86400 * 30);
                }
            }
            (0, logger_1.logInfo)('Analytics data cleanup completed');
        }
        catch (error) {
            (0, logger_1.logError)('Failed to cleanup analytics data', error);
        }
    }
}
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
//# sourceMappingURL=analyticsService.js.map