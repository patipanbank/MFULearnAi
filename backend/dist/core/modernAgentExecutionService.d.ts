import { EventEmitter } from 'events';
export interface ModernExecutionRequest {
    id: string;
    chatId: string;
    userId: string;
    agentId?: string;
    userMessage: string;
    chatHistory: Array<{
        role: string;
        content: string;
        timestamp: Date;
    }>;
    images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>;
    priority: ExecutionPriority;
    timeout?: number;
    createdAt: Date;
}
export interface ModernExecutionResult {
    id: string;
    success: boolean;
    result?: string;
    error?: string;
    metrics: ExecutionMetrics;
    streamingEvents: StreamingEvent[];
}
export interface ExecutionMetrics {
    startTime: number;
    endTime: number;
    duration: number;
    tokenUsage: {
        input: number;
        output: number;
    };
    iterations: number;
    toolsUsed: string[];
    memoryQueries: number;
}
export interface StreamingEvent {
    type: string;
    data: any;
    timestamp: number;
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
    TIMEOUT = "timeout"
}
export declare class ModernAgentExecutionService extends EventEmitter {
    private executionQueue;
    private activeExecutions;
    private executionResults;
    private maxConcurrentExecutions;
    constructor();
    execute(request: ModernExecutionRequest): Promise<ModernExecutionResult>;
    queueExecution(request: ModernExecutionRequest): Promise<void>;
    private processQueue;
    getExecutionResult(executionId: string): ModernExecutionResult | null;
    cancelExecution(executionId: string): boolean;
    getStats(): {
        activeExecutions: number;
        queuedExecutions: number;
        completedExecutions: number;
        maxConcurrentExecutions: number;
        averageExecutionTime: number;
    };
    cleanup(maxAge?: number): void;
    setMaxConcurrentExecutions(max: number): void;
}
export declare const modernAgentExecutionService: ModernAgentExecutionService;
//# sourceMappingURL=modernAgentExecutionService.d.ts.map