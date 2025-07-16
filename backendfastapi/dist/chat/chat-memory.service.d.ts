import { RedisService } from '../redis/redis.service';
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    id?: string;
}
export declare class ChatMemoryService {
    private readonly redisService;
    private readonly logger;
    private readonly MESSAGE_STORE_PREFIX;
    private readonly TTL_SECONDS;
    constructor(redisService: RedisService);
    private getMessageKey;
    addUserMessage(sessionId: string, content: string): Promise<void>;
    addAiMessage(sessionId: string, content: string): Promise<void>;
    addSystemMessage(sessionId: string, content: string): Promise<void>;
    private addMessage;
    getMessages(sessionId: string): Promise<ChatMessage[]>;
    clear(sessionId: string): Promise<void>;
    hasMemory(sessionId: string): Promise<boolean>;
    getMemoryStats(): Promise<{
        totalSessions: number;
        totalMessages: number;
    }>;
    restoreFromHistory(sessionId: string, messages: ChatMessage[]): Promise<void>;
}
export {};
