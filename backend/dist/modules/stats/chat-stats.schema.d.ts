import { Schema, Document } from 'mongoose';
export interface ChatStatsDocument extends Document {
    date: Date;
    uniqueUsers: string[];
    totalChats: number;
    totalTokens: number;
}
export declare const ChatStatsSchema: Schema<ChatStatsDocument, import("mongoose").Model<ChatStatsDocument, any, any, any, Document<unknown, any, ChatStatsDocument, any> & ChatStatsDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatStatsDocument, Document<unknown, {}, import("mongoose").FlatRecord<ChatStatsDocument>, {}> & import("mongoose").FlatRecord<ChatStatsDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
