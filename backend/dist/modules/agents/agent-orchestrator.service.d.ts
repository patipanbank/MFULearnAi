import { AgentService } from './agent.service';
import { AgentExecutionService } from './agent-execution.service';
import { ToolService } from './tool.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import { MemoryService } from '../../services/memory.service';
import { AgentExecutionStatus } from './agent-execution.schema';
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}
interface AgentExecutionRequest {
    agentId: string;
    sessionId: string;
    userId: string;
    message: string;
    context?: Message[];
}
interface AgentExecutionResult {
    executionId: string;
    response: string;
    toolsUsed: string[];
    tokenUsage: {
        input: number;
        output: number;
    };
    status: AgentExecutionStatus;
}
export declare class AgentOrchestratorService {
    private readonly agentService;
    private readonly agentExecutionService;
    private readonly toolService;
    private readonly bedrockService;
    private readonly memoryService;
    private readonly logger;
    constructor(agentService: AgentService, agentExecutionService: AgentExecutionService, toolService: ToolService, bedrockService: BedrockService, memoryService: MemoryService);
    executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
    private getAvailableToolsForAgent;
    private buildConversationContext;
    private getMemoryContext;
    private buildSystemPrompt;
    private callLLMWithToolSupport;
    private callBedrockForResponse;
    private parseToolCall;
    getAgentExecutionStatus(executionId: string): Promise<(import("mongoose").Document<unknown, {}, import("./agent-execution.schema").AgentExecutionDocument, {}> & import("./agent-execution.schema").AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    cancelAgentExecution(executionId: string): Promise<(import("mongoose").Document<unknown, {}, import("./agent-execution.schema").AgentExecutionDocument, {}> & import("./agent-execution.schema").AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    getExecutionHistory(sessionId: string): Promise<(import("mongoose").Document<unknown, {}, import("./agent-execution.schema").AgentExecutionDocument, {}> & import("./agent-execution.schema").AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
}
export {};
