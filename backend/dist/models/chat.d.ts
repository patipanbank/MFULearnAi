import mongoose, { Document } from 'mongoose';
export interface ImagePayload {
    url: string;
    mediaType: string;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    images?: ImagePayload[];
    isStreaming?: boolean;
    isComplete?: boolean;
}
export interface Chat extends Document {
    userId: string;
    name: string;
    messages: ChatMessage[];
    agentId?: string;
    modelId?: string;
    collectionNames?: string[];
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ChatModel: mongoose.Model<Chat, {}, {}, {}, mongoose.Document<unknown, {}, Chat, {}> & Chat & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=chat.d.ts.map