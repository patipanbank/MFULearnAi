import { ConfigService } from '../config/config.service';
import { BaseMessage } from '@langchain/core/messages';
export interface RedisHistoryConfig {
    sessionId: string;
    redisUrl: string;
    ttl?: number;
}
export declare class LangChainRedisHistoryService {
    private configService;
    private readonly logger;
    private histories;
    constructor(configService: ConfigService);
    createRedisHistory(sessionId: string): any;
    addMessage(sessionId: string, message: BaseMessage): Promise<void>;
    getMessages(sessionId: string): Promise<BaseMessage[]>;
    clearHistory(sessionId: string): Promise<void>;
    restoreMemory(sessionId: string, messages: Array<{
        role: string;
        content: string;
    }>): Promise<void>;
    checkRedisMemoryExists(sessionId: string): Promise<boolean>;
    private setHistoryTTL;
    getHistoryStats(): Promise<{
        totalSessions: number;
        activeSessions: string[];
    }>;
}
