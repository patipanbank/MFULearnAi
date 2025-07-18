import mongoose, { Document } from 'mongoose';
export interface ImagePayload {
    url: string;
    mediaType: string;
}
export interface ToolUsage {
    type: 'tool_start' | 'tool_result' | 'tool_error';
    tool_name: string;
    tool_input?: string;
    output?: string;
    error?: string;
    timestamp: Date;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    images?: ImagePayload[];
    isStreaming?: boolean;
    isComplete?: boolean;
    toolUsage?: ToolUsage[];
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