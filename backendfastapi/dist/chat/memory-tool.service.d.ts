import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../collection/chroma.service';
export interface MemoryDocument {
    id: string;
    content: string;
    metadata: Record<string, any>;
    similarity?: number;
}
export interface SearchResult {
    documents: MemoryDocument[];
    query: string;
    totalResults: number;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}
export declare class MemoryToolService {
    private configService;
    private bedrockService;
    private chromaService;
    private readonly logger;
    private readonly MAX_DOCUMENTS_PER_COLLECTION;
    private readonly EMBED_THRESHOLD;
    private vectorStores;
    constructor(configService: ConfigService, bedrockService: BedrockService, chromaService: ChromaService);
    shouldEmbedMessages(messageCount: number): boolean;
    addChatMemory(chatId: string, messages: ChatMessage[]): Promise<void>;
    clearChatMemory(chatId: string): Promise<void>;
    searchMemory(query: string, collectionName: string, limit?: number, modelId?: string): Promise<SearchResult>;
    addToMemory(content: string, collectionName: string, metadata?: Record<string, any>, modelId?: string): Promise<{
        success: boolean;
        documentId: string;
    }>;
    removeFromMemory(documentId: string, collectionName: string): Promise<{
        success: boolean;
    }>;
    getMemoryStats(collectionName?: string): Promise<{
        totalDocuments: number;
        totalSessions: number;
        totalMessages: number;
        collectionName?: string;
        status: string;
    }>;
    clearMemory(collectionName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    updateMemoryDocument(documentId: string, newContent: string, collectionName: string, metadata?: Record<string, any>, modelId?: string): Promise<{
        success: boolean;
    }>;
    findRelatedMemories(conversationHistory: string[], collectionName: string, limit?: number, modelId?: string): Promise<MemoryDocument[]>;
    getMemorySummary(collectionName: string): Promise<{
        totalDocuments: number;
        sampleDocuments: string[];
        averageContentLength: number;
        modelIds: string[];
    }>;
}
