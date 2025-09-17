export interface ToolConfig {
    id: string;
    name: string;
    description: string;
    version: string;
    category: ToolCategory;
    type: ToolType;
    enabled: boolean;
    dependencies?: string[];
    config: Record<string, any>;
    metadata: ToolMetadata;
}
export interface ToolMetadata {
    author?: string;
    tags: string[];
    documentation?: string;
    examples?: ToolExample[];
    performance?: ToolPerformance;
    lastUpdated: Date;
    usage_count: number;
}
export interface ToolExample {
    input: string;
    expectedOutput: string;
    description: string;
}
export interface ToolPerformance {
    averageResponseTime: number;
    successRate: number;
    lastBenchmark: Date;
}
export declare enum ToolCategory {
    CORE = "core",
    SEARCH = "search",
    CALCULATION = "calculation",
    MEMORY = "memory",
    RETRIEVAL = "retrieval",
    INTEGRATION = "integration",
    UTILITY = "utility",
    CUSTOM = "custom"
}
export declare enum ToolType {
    STATIC = "static",
    DYNAMIC = "dynamic",
    SESSION_SPECIFIC = "session_specific",
    COLLECTION_SPECIFIC = "collection_specific"
}
export interface ToolExecutionContext {
    sessionId?: string;
    userId?: string;
    agentId?: string;
    collectionNames?: string[];
    config?: Record<string, any>;
}
export interface ToolExecutionResult {
    success: boolean;
    result: string;
    error?: string;
    executionTime: number;
    tokensUsed?: number;
    metadata?: Record<string, any>;
}
export type ToolFunction = (input: string, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
export declare class UnifiedToolRegistry {
    private static instance;
    private tools;
    private toolFunctions;
    private activeTools;
    private memoryToolsCreated;
    private constructor();
    static getInstance(): UnifiedToolRegistry;
    registerTool(config: ToolConfig, func: ToolFunction): void;
    getAvailableTools(context: ToolExecutionContext): ToolConfig[];
    executeTool(toolId: string, input: string, context: ToolExecutionContext): Promise<ToolExecutionResult>;
    createSessionTools(sessionId: string): ToolConfig[];
    createMemorySearchToolsIfNeeded(sessionId: string): Promise<ToolConfig[]>;
    createCollectionTools(collectionNames: string[]): ToolConfig[];
    cleanupSessionTools(sessionId: string): void;
    getToolStatistics(): Record<string, any>;
    private initializeCorTools;
    private createWebSearchFunction;
    private createCalculatorFunction;
    private createCurrentDateFunction;
    private createMemoryToolFunction;
    private createCollectionSearchFunction;
}
export declare const unifiedToolRegistry: UnifiedToolRegistry;
//# sourceMappingURL=unifiedToolRegistry.d.ts.map