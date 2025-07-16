import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChatMemoryService } from '../chat/chat-memory.service';
import { MemoryToolService } from '../chat/memory-tool.service';
interface ChatRequest {
    sessionId: string;
    userId: string;
    message: string;
    modelId: string;
    collectionNames: string[];
    agentId?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    images?: any[];
}
export declare class LangChainChatService {
    private configService;
    private bedrockService;
    private chatMemoryService;
    private memoryToolService;
    private readonly logger;
    constructor(configService: ConfigService, bedrockService: BedrockService, chatMemoryService: ChatMemoryService, memoryToolService: MemoryToolService);
    chat(request: ChatRequest): AsyncGenerator<string, void, unknown>;
    clearChatMemory(sessionId: string): Promise<void>;
    shouldEmbedMessages(messageCount: number): boolean;
    shouldUseMemoryTool(messageCount: number): boolean;
}
export {};
