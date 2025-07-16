import { Document, Types } from 'mongoose';
export type ChatDocument = Chat & Document;
export declare class ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isStreaming: boolean;
    isComplete: boolean;
    metadata?: any;
}
export declare const ChatMessageSchema: import("mongoose").Schema<ChatMessage, import("mongoose").Model<ChatMessage, any, any, any, Document<unknown, any, ChatMessage, any> & ChatMessage & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatMessage, Document<unknown, {}, import("mongoose").FlatRecord<ChatMessage>, {}> & import("mongoose").FlatRecord<ChatMessage> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class Chat {
    userId: Types.ObjectId;
    id?: string;
    title: string;
    name?: string;
    messages: ChatMessage[];
    agentId?: Types.ObjectId;
    modelId?: string;
    collectionNames?: string[];
    systemPrompt?: string;
    created: Date;
    updated: Date;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    isPinned: boolean;
    metadata?: any;
}
export declare const ChatSchema: import("mongoose").Schema<Chat, import("mongoose").Model<Chat, any, any, any, Document<unknown, any, Chat, any> & Chat & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Chat, Document<unknown, {}, import("mongoose").FlatRecord<Chat>, {}> & import("mongoose").FlatRecord<Chat> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
