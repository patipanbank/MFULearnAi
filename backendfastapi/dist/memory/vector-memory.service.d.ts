import { ConfigService } from '../config/config.service';
import { Document } from '@langchain/core/documents';
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}
export declare class VectorMemoryService {
    private configService;
    private readonly logger;
    private vectorStore;
    private embeddings;
    constructor(configService: ConfigService);
    private initializeVectorStore;
    private initializeEmbeddings;
    addMemory(sessionId: string, content: string, metadata?: any): Promise<void>;
    searchMemory(sessionId: string, query: string, k?: number): Promise<Document[]>;
    clearMemory(sessionId: string): Promise<void>;
}
