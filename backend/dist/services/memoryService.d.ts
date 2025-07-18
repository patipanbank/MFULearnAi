import { ChatMessage } from '../models/chat';
export interface MemoryEntry {
    content: string;
    role: string;
    timestamp: Date;
    messageId: string;
    embedding?: number[];
}
export declare class MemoryService {
    private memoryStores;
    constructor();
    addChatMemory(sessionId: string, messages: ChatMessage[]): Promise<void>;
    searchChatMemory(sessionId: string, query: string, k?: number): Promise<MemoryEntry[]>;
    getRecentMessages(sessionId: string, limit?: number): MemoryEntry[];
    getAllMessages(sessionId: string): MemoryEntry[];
    clearChatMemory(sessionId: string): void;
    getMemoryStats(): Record<string, any>;
    private calculateCosineSimilarity;
    shouldUseMemoryTool(messageCount: number): boolean;
    shouldEmbedMessages(messageCount: number): boolean;
}
export declare const memoryService: MemoryService;
//# sourceMappingURL=memoryService.d.ts.map