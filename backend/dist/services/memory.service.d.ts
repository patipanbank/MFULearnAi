import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { ChromaService } from './chroma.service';
import { Redis } from 'ioredis';
interface ChatMemoryMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date | string;
    metadata?: Record<string, any>;
}
interface MemorySearchResult {
    documents: string[][];
    metadatas: Record<string, any>[][];
    distances: number[][];
}
export interface MemoryStats {
    sessionId: string;
    totalMessages: number;
    embeddedMessages: number;
    lastEmbeddingTime?: Date;
    memorySize: number;
    averageMessageLength: number;
}
export declare class MemoryService {
    private readonly bedrockService;
    private readonly chromaService;
    private readonly redis;
    private readonly logger;
    private readonly maxMessagesInMemory;
    private readonly embeddingThreshold;
    private readonly maxSearchResults;
    constructor(bedrockService: BedrockService, chromaService: ChromaService, redis: Redis);
    private collectionName;
    private cacheKey;
    addChatMemory(sessionId: string, messages: ChatMemoryMessage[]): Promise<void>;
    private getExistingMessageIds;
    private processBatch;
    searchChatMemory(sessionId: string, query: string, topK?: number, minSimilarity?: number): Promise<MemorySearchResult | null>;
    private filterBySimilarity;
    getMemoryStats(sessionId: string): Promise<MemoryStats>;
    clearChatMemory(sessionId: string): Promise<void>;
    optimizeMemory(sessionId: string): Promise<void>;
    private cleanupOldMemories;
    private updateMemoryStats;
    private getTotalSessions;
    getGlobalMemoryStats(): Promise<{
        totalSessions: number;
        totalMessages: number;
        averageMessagesPerSession: number;
    }>;
    shouldEmbedSession(messageCount: number): boolean;
    preloadMemory(sessionId: string): Promise<void>;
}
export {};
