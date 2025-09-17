import { EventEmitter } from 'events';
import { TokenUsage } from '../models/agent';
export interface ExecutionRequest {
    id: string;
    chatId: string;
    userId: string;
    agentId?: string;
    prompt: string;
    context: any;
    priority: ExecutionPriority;
    timeout?: number;
    retryCount?: number;
    createdAt: Date;
}
export interface ExecutionResult {
    id: string;
    success: boolean;
    result?: string;
    error?: string;
    metrics: ExecutionMetrics;
    toolExecutions: ToolExecutionMetrics[];
}
export interface ExecutionMetrics {
    startTime: number;
    endTime: number;
    duration: number;
    tokenUsage: TokenUsage;
    toolCount: number;
    retryCount: number;
    memoryUsage?: number;
}
export interface ToolExecutionMetrics {
    toolId: string;
    startTime: number;
    endTime: number;
    duration: number;
    success: boolean;
    error?: string;
    inputSize: number;
    outputSize: number;
}
export declare enum ExecutionPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}
export declare enum ExecutionStatus {
    QUEUED = "queued",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    TIMEOUT = "timeout",
    CANCELLED = "cancelled"
}
export declare class AgentExecutionService extends EventEmitter {
    private static instance;
    private executionQueue;
    private activeExecutions;
    private executionHistory;
    private agentCache;
    private metrics;
    private constructor();
    static getInstance(): AgentExecutionService;
    executeAgent(request: ExecutionRequest): Promise<ExecutionResult>;
    private createExecutionContext;
    private performExecution;
    private handleExecutionEvent;
    private generateAgentCacheKey;
    private isAgentExpired;
    private updateToolPerformance;
    private startMetricsCollection;
    private collectMetrics;
    private startCacheCleanup;
    private cleanupCache;
    private updateMetrics;
    private updateExecutionHistory;
    getMetrics(): ServiceMetrics;
    getExecutionHistory(limit?: number): ExecutionResult[];
    getToolStatistics(): any;
    cancelExecution(executionId: string): Promise<boolean>;
    getQueueStatus(): QueueStatus;
    private calculateAverageWaitTime;
}
interface ServiceMetrics {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    totalTokensUsed: number;
    activeExecutions: number;
    queueSize: number;
}
interface QueueStatus {
    queueSize: number;
    activeExecutions: number;
    cacheSize: number;
    averageWaitTime: number;
}
export declare const agentExecutionService: AgentExecutionService;
export {};
//# sourceMappingURL=agentExecutionService.d.ts.map