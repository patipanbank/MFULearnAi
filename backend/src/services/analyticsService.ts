import { getRedis } from '../lib/redis';
import { logPerformance, logAgentEvent, logToolUsage, logInfo, logError } from '../utils/logger';

export interface AnalyticsEvent {
  type: string;
  userId?: string;
  agentId?: string;
  chatId?: string;
  toolName?: string;
  duration?: number;
  metadata?: any;
  timestamp: Date;
}

export interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  activeUsers: number;
  agentUsage: Record<string, string>;
  toolUsage: Record<string, string>;
}

export class AnalyticsService {
  private redis: any = null;

  constructor() {
    console.log('✅ Analytics service initialized');
  }

  private getRedis() {
    if (!this.redis) {
      this.redis = getRedis();
    }
    return this.redis;
  }

  // Track user activity
  async trackUserActivity(userId: string, action: string, metadata?: any): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type: 'user_activity',
        userId,
        metadata: { action, ...metadata },
        timestamp: new Date()
      };

      const redis = this.getRedis();
      await redis.lpush('analytics:user_activity', JSON.stringify(event));
      await redis.expire('analytics:user_activity', 86400 * 7); // 7 days

      // Track active users
      await redis.sadd('analytics:active_users', userId);
      await redis.expire('analytics:active_users', 3600); // 1 hour

      logInfo(`User activity tracked: ${action}`, { userId, action, metadata });
    } catch (error) {
      logError('Failed to track user activity', error, { userId, action });
    }
  }

  // Track agent usage
  async trackAgentUsage(agentId: string, userId: string, duration: number, metadata?: any): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type: 'agent_usage',
        agentId,
        userId,
        duration,
        metadata,
        timestamp: new Date()
      };

      const redis = this.getRedis();
      await redis.lpush('analytics:agent_usage', JSON.stringify(event));
      await redis.expire('analytics:agent_usage', 86400 * 30); // 30 days

      // Increment agent usage counter
      await redis.hincrby('analytics:agent_stats', agentId, 1);
      await redis.expire('analytics:agent_stats', 86400 * 30); // 30 days

      logAgentEvent('usage', { agentId, userId, duration, metadata });
    } catch (error) {
      logError('Failed to track agent usage', error, { agentId, userId });
    }
  }

  // Track tool usage
  async trackToolUsage(toolName: string, userId: string, input: string, output: string, duration: number): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type: 'tool_usage',
        userId,
        toolName,
        duration,
        metadata: { input, output },
        timestamp: new Date()
      };

      const redis = this.getRedis();
      await redis.lpush('analytics:tool_usage', JSON.stringify(event));
      await redis.expire('analytics:tool_usage', 86400 * 30); // 30 days

      // Increment tool usage counter
      await redis.hincrby('analytics:tool_stats', toolName, 1);
      await redis.expire('analytics:tool_stats', 86400 * 30); // 30 days

      logToolUsage(toolName, input, output, duration);
    } catch (error) {
      logError('Failed to track tool usage', error, { toolName, userId });
    }
  }

  // Track chat events
  async trackChatEvent(chatId: string, userId: string, eventType: string, metadata?: any): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type: 'chat_event',
        chatId,
        userId,
        metadata: { eventType, ...metadata },
        timestamp: new Date()
      };

      const redis = this.getRedis();
      await redis.lpush('analytics:chat_events', JSON.stringify(event));
      await redis.expire('analytics:chat_events', 86400 * 7); // 7 days

      logInfo(`Chat event tracked: ${eventType}`, { chatId, userId, eventType, metadata });
    } catch (error) {
      logError('Failed to track chat event', error, { chatId, userId, eventType });
    }
  }

  // Track performance metrics
  async trackPerformance(operation: string, duration: number, metadata?: any): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        type: 'performance',
        duration,
        metadata: { operation, ...metadata },
        timestamp: new Date()
      };

      const redis = this.getRedis();
      await redis.lpush('analytics:performance', JSON.stringify(event));
      await redis.expire('analytics:performance', 86400 * 7); // 7 days

      logPerformance(operation, duration, metadata);
    } catch (error) {
      logError('Failed to track performance', error, { operation, duration });
    }
  }

  // Get analytics data
  async getAnalytics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      const now = Date.now();
      let cutoff: number;

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

      // Get recent events
      const userActivity = await this.getRecentEvents('analytics:user_activity', cutoff);
      const agentUsage = await this.getRecentEvents('analytics:agent_usage', cutoff);
      const toolUsage = await this.getRecentEvents('analytics:tool_usage', cutoff);
      const chatEvents = await this.getRecentEvents('analytics:chat_events', cutoff);
      const performance = await this.getRecentEvents('analytics:performance', cutoff);

      // Get stats
      const redis = this.getRedis();
      const agentStats = await redis.hgetall('analytics:agent_stats');
      const toolStats = await redis.hgetall('analytics:tool_stats');
      const activeUsers = await redis.scard('analytics:active_users');

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
    } catch (error) {
      logError('Failed to get analytics', error);
      return null;
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics | null> {
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

      const redis = this.getRedis();
      const activeUsers = await redis.scard('analytics:active_users');
      const agentStats = await redis.hgetall('analytics:agent_stats');
      const toolStats = await redis.hgetall('analytics:tool_stats');

      return {
        totalRequests,
        averageResponseTime,
        errorRate,
        activeUsers,
        agentUsage: agentStats,
        toolUsage: toolStats
      };
    } catch (error) {
      logError('Failed to get performance metrics', error);
      return null;
    }
  }

  // Get recent events from Redis
  private async getRecentEvents(key: string, cutoff: number): Promise<any[]> {
    try {
      const events = await this.redis.lrange(key, 0, -1);
      return events
        .map(event => JSON.parse(event))
        .filter(event => new Date(event.timestamp).getTime() > cutoff)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      logError(`Failed to get recent events for ${key}`, error);
      return [];
    }
  }

  // Clean up old analytics data
  async cleanupOldData(): Promise<void> {
    try {
      // This would be called by a cron job
      const keys = [
        'analytics:user_activity',
        'analytics:agent_usage',
        'analytics:tool_usage',
        'analytics:chat_events',
        'analytics:performance'
      ];

      for (const key of keys) {
        // Keep only last 30 days of data
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const events = await this.getRecentEvents(key, cutoff);
        
        // Clear old data
        await this.redis.del(key);
        
        // Re-add recent events
        if (events.length > 0) {
          await this.redis.lpush(key, ...events.map(event => JSON.stringify(event)));
          await this.redis.expire(key, 86400 * 30);
        }
      }

      logInfo('Analytics data cleanup completed');
    } catch (error) {
      logError('Failed to cleanup analytics data', error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService(); 