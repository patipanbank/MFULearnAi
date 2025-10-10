/**
 * 🔧 Unified Tool Registry System
 *
 * ระบบจัดการ tools แบบรวมศูนย์ที่รอบคอบและมีประสิทธิภาพ
 * - Centralized tool management
 * - Dynamic tool loading with validation
 * - Tool versioning and dependency management
 * - Consistent interface across backend and frontend
 * - Memory management และ cleanup
 */
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
    private constructor();
    static getInstance(): UnifiedToolRegistry;
    /**
     * Register a new tool
     */
    registerTool(config: ToolConfig, func: ToolFunction): void;
    /**
     * Get available tools for specific context
     */
    getAvailableTools(context: ToolExecutionContext): ToolConfig[];
    /**
     * Execute tool with full context and monitoring
     */
    executeTool(toolId: string, input: string, context: ToolExecutionContext): Promise<ToolExecutionResult>;
    /**
     * Create session-specific tools
     */
    createSessionTools(sessionId: string): ToolConfig[];
    /**
     * Create collection-specific search tools
     */
    createCollectionTools(collectionNames: string[]): ToolConfig[];
    /**
     * Clean up session-specific tools
     */
    cleanupSessionTools(sessionId: string): void;
    /**
     * Get tool statistics
     */
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