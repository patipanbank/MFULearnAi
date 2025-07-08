import { ChatService } from './chat.service';
import { MemoryService } from '../../services/memory.service';
export declare class ChatController {
    private readonly chatService;
    private readonly memoryService;
    constructor(chatService: ChatService, memoryService: MemoryService);
    list(req: any): Promise<(import("mongoose").Document<unknown, {}, import("./chat.schema").ChatDocument, {}> & import("./chat.schema").ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    create(req: any, name: string, agentId?: string): Promise<import("mongoose").Document<unknown, {}, import("./chat.schema").ChatDocument, {}> & import("./chat.schema").ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addMessage(chatId: string, req: any, content: string): Promise<(import("mongoose").Document<unknown, {}, import("./chat.schema").ChatDocument, {}> & import("./chat.schema").ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    ask(chatId: string, req: any, content: string, modelId?: string, systemPrompt?: string, temperature?: number, maxTokens?: number): Promise<{
        status: string;
        channel: string;
    }>;
    clearMemory(chatId: string): Promise<{
        status: string;
    }>;
    memoryStats(chatId: string): Promise<import("../../services/memory.service").MemoryStats>;
}
