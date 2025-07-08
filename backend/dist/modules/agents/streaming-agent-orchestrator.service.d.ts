import { AgentService } from './agent.service';
import { AgentExecutionService } from './agent-execution.service';
import { ToolService } from './tool.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
import { MemoryService } from '../../services/memory.service';
import { StreamingService } from '../../services/streaming.service';
import { StreamingAgentExecutionRequest } from '../../common/schemas';
interface StreamingExecutionResult {
    executionId: string;
    sessionId: string;
    status: 'streaming' | 'completed' | 'error';
}
export declare class StreamingAgentOrchestratorService {
    private readonly agentService;
    private readonly agentExecutionService;
    private readonly toolService;
    private readonly bedrockService;
    private readonly memoryService;
    private readonly streamingService;
    private readonly logger;
    constructor(agentService: AgentService, agentExecutionService: AgentExecutionService, toolService: ToolService, bedrockService: BedrockService, memoryService: MemoryService, streamingService: StreamingService);
    executeAgentStreaming(request: StreamingAgentExecutionRequest): Promise<StreamingExecutionResult>;
    private executeStreamingLoop;
    private callLLMWithStreaming;
    private getAvailableToolsForAgent;
    private buildConversationContext;
    private getMemoryContext;
    private buildSystemPrompt;
    cancelStreamingExecution(sessionId: string): Promise<void>;
    getStreamingStatus(sessionId: string): Promise<any>;
}
export {};
