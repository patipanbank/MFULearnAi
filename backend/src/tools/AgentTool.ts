export interface ToolResult {
    success: boolean;
    result: unknown;
    error?: string;
}

/**
 * Context provided to tools during execution.
 * This is a subset of the full AgentContext (from AgentTypes.ts),
 * containing only what tools need to know about the caller.
 */
export interface ToolExecutionContext {
    userId: string;
    role: string;
    department?: string;
    collectionId?: string;
    // API Key KB access restrictions
    isApiKey?: boolean;
    allowedDepartments?: string[];
    allowedKnowledgeIds?: string[];
}

/** Bedrock Converse API tool definition schema. */
export interface ToolSchemaJSON {
    name: string;
    description: string;
    inputSchema: {
        json: {
            type: string;
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}

export abstract class AgentTool {
    abstract name: string;
    abstract description: string;
    abstract allowedRoles: string[];

    /** Semantic version for schema evolution tracking (e.g., "1.0.0"). */
    version: string = '1.0.0';

    /** Native JSON Schema for Bedrock Converse API tool definitions. */
    abstract schemaJSON: ToolSchemaJSON;

    /**
     * Graceful degradation policy when this tool fails.
     * - 'error': Return error to LLM (default).
     * - 'fallback': Use cached result from previous session if available.
     * - 'skip': Silently skip and let LLM continue without this tool's result.
     * - 'retry_with_default': Retry with default/simplified args.
     */
    degradationPolicy: 'error' | 'fallback' | 'skip' | 'retry_with_default' = 'error';

    /** Default args to use in 'retry_with_default' degradation policy. */
    defaultArgs?: Record<string, unknown>;

    abstract execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;

    isAllowed(role: string): boolean {
        return this.allowedRoles.includes(role) || this.allowedRoles.includes('*');
    }
}
