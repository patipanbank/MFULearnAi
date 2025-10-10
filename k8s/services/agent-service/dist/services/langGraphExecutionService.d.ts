/**
 * LangGraph Execution Service
 *
 * Handles agent execution using LangGraph StateGraph
 * Replaces the old AgentExecutor-based approach
 */
import { EventEmitter } from 'events';
export interface ExecutionRequest {
    chatId: string;
    userId: string;
    agentId?: string;
    userContent: string;
    images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>;
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    collectionNames?: string[];
    systemPrompt?: string;
    chatHistory?: Array<{
        role: string;
        content: string;
        id: string;
        timestamp: Date;
    }>;
}
export interface ExecutionResponse {
    success: boolean;
    answer: string;
    metadata?: any;
    toolsUsed?: string[];
    error?: string;
}
declare class LangGraphExecutionService extends EventEmitter {
    private static instance;
    private constructor();
    static getInstance(): LangGraphExecutionService;
    /**
     * Execute agent with streaming support
     */
    executeAgent(request: ExecutionRequest, onEvent?: (event: {
        type: string;
        data?: any;
    }) => void): Promise<ExecutionResponse>;
    /**
     * Get agent configuration with defaults
     */
    private getAgentConfig;
    /**
     * Prepare chat history for LangChain messages
     */
    private prepareChatHistory;
    /**
     * Get execution statistics
     */
    getStatistics(): {
        activeExecutions: number;
        totalExecutions: number;
        averageExecutionTime: number;
    };
}
export declare const langGraphExecutionService: LangGraphExecutionService;
export {};
//# sourceMappingURL=langGraphExecutionService.d.ts.map