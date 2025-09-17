import { EventEmitter } from 'events';
export interface ToolExecution {
    id: string;
    toolName: string;
    inputs: Record<string, any>;
    priority: 'low' | 'normal' | 'high' | 'critical';
    timeout: number;
    retryCount: number;
    dependsOn: string[];
    parallel: boolean;
    optional: boolean;
}
export interface ToolResult {
    id: string;
    toolName: string;
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
    retryAttempts: number;
    inputSize: number;
    outputSize: number;
    timestamp: Date;
}
export interface ExecutionBatch {
    id: string;
    executions: ToolExecution[];
    results: Map<string, ToolResult>;
    startTime: number;
    endTime?: number;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
}
export interface ToolPerformanceMetrics {
    toolName: string;
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    averageInputSize: number;
    averageOutputSize: number;
    errorPatterns: Record<string, number>;
    lastExecuted: Date;
}
export interface DependencyGraph {
    nodes: Set<string>;
    edges: Map<string, Set<string>>;
    levels: string[][];
}
export declare class ParallelToolExecutor extends EventEmitter {
    private static instance;
    private activeBatches;
    private toolRegistry;
    private performanceMetrics;
    private concurrencyLimit;
    private activeExecutions;
    private constructor();
    static getInstance(): ParallelToolExecutor;
    executeParallelTools(executions: ToolExecution[], sessionContext?: any): Promise<Map<string, ToolResult>>;
    executeSingleTool(toolName: string, inputs: Record<string, any>, options?: {
        timeout?: number;
        retryCount?: number;
        priority?: 'low' | 'normal' | 'high' | 'critical';
    }): Promise<ToolResult>;
    private buildDependencyGraph;
    private calculateExecutionLevels;
    private validateDependencyGraph;
    private executeByLevels;
    private executeParallelBatch;
    private executeWithRetry;
    private executeToolWithTimeout;
    private executeTool;
    private setupPerformanceTracking;
    private updateToolMetrics;
    private updateBatchMetrics;
    private calculateParallelEfficiency;
    private categorizeError;
    private chunkArray;
    registerTool(name: string, tool: any): void;
    getToolMetrics(toolName?: string): ToolPerformanceMetrics[];
    getActiveBatchesCount(): number;
    getActiveExecutionsCount(): number;
    setConcurrencyLimit(limit: number): void;
    cancelBatch(batchId: string): Promise<boolean>;
    static createExecution(toolName: string): ToolExecutionBuilder;
}
export declare class ToolExecutionBuilder {
    private execution;
    constructor(toolName: string);
    withInputs(inputs: Record<string, any>): ToolExecutionBuilder;
    withPriority(priority: 'low' | 'normal' | 'high' | 'critical'): ToolExecutionBuilder;
    withTimeout(timeout: number): ToolExecutionBuilder;
    withRetries(retryCount: number): ToolExecutionBuilder;
    dependsOn(...executionIds: string[]): ToolExecutionBuilder;
    sequential(): ToolExecutionBuilder;
    optional(): ToolExecutionBuilder;
    build(): ToolExecution;
}
export declare const parallelToolExecutor: ParallelToolExecutor;
//# sourceMappingURL=parallelToolExecutor.d.ts.map