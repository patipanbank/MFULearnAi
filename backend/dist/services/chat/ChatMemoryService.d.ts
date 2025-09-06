import type { MemoryConfig } from './types/chat-service.types';
import type { ChatMessage } from '../../models/chat';
export declare class ChatMemoryService {
    constructor();
    analyzeMemoryNeeds(messageCount: number): MemoryConfig;
    setupHybridMemory(chatId: string, messages: ChatMessage[]): Promise<void>;
    clearChatMemory(chatId: string): Promise<void>;
    private shouldUseMemoryTool;
    private shouldUseRedisMemory;
    private shouldEmbedMessages;
}
export declare const chatMemoryService: ChatMemoryService;
//# sourceMappingURL=ChatMemoryService.d.ts.map