import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChatService } from '../../modules/chat/chat.service';
import { Redis } from 'ioredis';
import { MemoryService } from '../../services/memory.service';
import { AgentExecutionService } from '../../modules/agents/agent-execution.service';
import { AgentOrchestratorService } from '../../modules/agents/agent-orchestrator.service';
import { AgentService } from '../../modules/agents/agent.service';
interface ChatJobPayload {
    sessionId: string;
    userId: string;
    message: string;
    modelId?: string;
    systemPrompt?: string;
    agentId?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare class ChatWorker extends WorkerHost {
    private readonly bedrockService;
    private readonly chatService;
    private readonly execService;
    private readonly agentOrchestratorService;
    private readonly agentService;
    private readonly redis;
    private readonly memoryService;
    private readonly logger;
    constructor(bedrockService: BedrockService, chatService: ChatService, execService: AgentExecutionService, agentOrchestratorService: AgentOrchestratorService, agentService: AgentService, redis: Redis, memoryService: MemoryService);
    process(job: Job<ChatJobPayload>): Promise<void>;
    private processWithAgent;
    private processWithSimpleLLM;
    private streamResponse;
    private embedChatHistory;
}
export {};
