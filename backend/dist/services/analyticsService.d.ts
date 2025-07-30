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
export declare class AnalyticsService {
    private redis;
    constructor();
    private getRedis;
    trackUserActivity(userId: string, action: string, metadata?: any): Promise<void>;
    trackAgentUsage(agentId: string, userId: string, duration: number, metadata?: any): Promise<void>;
    trackToolUsage(toolName: string, userId: string, input: string, output: string, duration: number): Promise<void>;
    trackChatEvent(chatId: string, userId: string, eventType: string, metadata?: any): Promise<void>;
    trackPerformance(operation: string, duration: number, metadata?: any): Promise<void>;
    getAnalytics(timeRange?: '1h' | '24h' | '7d' | '30d'): Promise<any>;
    getPerformanceMetrics(): Promise<PerformanceMetrics | null>;
    private getRecentEvents;
    cleanupOldData(): Promise<void>;
}
export declare const analyticsService: AnalyticsService;
//# sourceMappingURL=analyticsService.d.ts.map