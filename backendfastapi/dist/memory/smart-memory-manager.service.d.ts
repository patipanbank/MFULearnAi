import { VectorMemoryService } from './vector-memory.service';
import { LangChainRedisHistoryService } from './langchain-redis-history.service';
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}
export declare class SmartMemoryManagerService {
    private vectorMemoryService;
    private redisHistoryService;
    private readonly logger;
    constructor(vectorMemoryService: VectorMemoryService, redisHistoryService: LangChainRedisHistoryService);
    setupSmartMemoryManagement(sessionId: string, messages: ChatMessage[]): Promise<void>;
    getMemoryStrategy(messageCount: number): 'basic' | 'redis' | 'vector';
    shouldUseMemoryTool(messageCount: number): boolean;
    shouldUseRedisMemory(messageCount: number): boolean;
    shouldEmbedMessages(messageCount: number): boolean;
    getRelevantContext(sessionId: string, query: string, messageCount: number): Promise<ChatMessage[]>;
    private convertRedisMessages;
    clearAllMemory(sessionId: string): Promise<void>;
    getMemoryStats(): Promise<{
        redis: any;
        vector: any;
        totalSessions: number;
    }>;
    addMessage(sessionId: string, message: ChatMessage, messageCount: number): Promise<void>;
}
