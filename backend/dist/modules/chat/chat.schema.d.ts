import { Schema, Document, Types } from 'mongoose';
export interface MessageDocument extends Document {
    role: 'user' | 'assistant';
    content: string;
    images?: {
        url: string;
        mediaType: string;
    }[];
    timestamp: Date;
}
export declare const MessageSchema: Schema<MessageDocument, import("mongoose").Model<MessageDocument, any, any, any, Document<unknown, any, MessageDocument, any> & MessageDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, MessageDocument, Document<unknown, {}, import("mongoose").FlatRecord<MessageDocument>, {}> & import("mongoose").FlatRecord<MessageDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
export interface ChatDocument extends Document {
    userId: string;
    name: string;
    agentId?: string;
    messages: Types.DocumentArray<MessageDocument>;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ChatSchema: Schema<ChatDocument, import("mongoose").Model<ChatDocument, any, any, any, Document<unknown, any, ChatDocument, any> & ChatDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatDocument, Document<unknown, {}, import("mongoose").FlatRecord<ChatDocument>, {}> & import("mongoose").FlatRecord<ChatDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
