import { Model } from 'mongoose';
import { ChatDocument, MessageDocument } from './chat.schema';
import { Queue } from 'bullmq';
export declare class ChatService {
    private readonly chatModel;
    private readonly queue;
    constructor(chatModel: Model<ChatDocument>, queue: Queue);
    findAllByUser(userId: string): Promise<(import("mongoose").Document<unknown, {}, ChatDocument, {}> & ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    createChat(userId: string, name: string, agentId?: string): Promise<import("mongoose").Document<unknown, {}, ChatDocument, {}> & ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    addMessage(chatId: string, message: Partial<MessageDocument>): Promise<(import("mongoose").Document<unknown, {}, ChatDocument, {}> & ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    getChatById(chatId: string): Promise<(import("mongoose").Document<unknown, {}, ChatDocument, {}> & ChatDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    generateAnswer(payload: any): Promise<void>;
}
