/**
 * Agent Execution Service
 *
 * ระบบจัดการ Agent Execution
 * - Performance monitoring และ metrics
 * - Execution queue management
 * - Error handling และ recovery
 * - Resource optimization
 *
 * NOTE: This service is compatible with both legacy and LangGraph agents
 * The agentFactory.ts now uses LangGraph StateGraph by default
 */
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
    /**
     * Execute agent with monitoring
     */
    executeAgent(request: ExecutionRequest): Promise<ExecutionResult>;
    /**
     * Create execution context with resource allocation
     */
    private createExecutionContext;
    /**
     * Perform actual execution with monitoring
     */
    private performExecution;
    /**
     * Handle execution events with detailed tracking
     */
    private handleExecutionEvent;
    /**
     * Generate cache key for agent
     */
    private generateAgentCacheKey;
    /**
     * Check if cached agent is expired
     */
    private isAgentExpired;
    /**
     * Update tool performance metrics
     */
    private updateToolPerformance;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Collect system metrics
     */
    private collectMetrics;
    /**
     * Start cache cleanup process
     */
    private startCacheCleanup;
    /**
     * Cleanup expired cache entries
     */
    private cleanupCache;
    /**
     * Update service metrics
     */
    private updateMetrics;
    /**
     * Update execution history
     */
    private updateExecutionHistory;
    /**
     * Get service metrics
     */
    getMetrics(): ServiceMetrics;
    /**
     * Get execution history
     */
    getExecutionHistory(limit?: number): ExecutionResult[];
    /**
     * Get tool performance statistics
     */
    getToolStatistics(): any;
    /**
     * Cancel execution
     */
    cancelExecution(executionId: string): Promise<boolean>;
    /**
     * Get queue status
     */
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