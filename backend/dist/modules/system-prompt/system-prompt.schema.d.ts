import { Schema, Document } from 'mongoose';
export interface SystemPromptDocument extends Document {
    prompt: string;
    updatedBy: string;
    updatedAt: Date;
}
export declare const SystemPromptSchema: Schema<SystemPromptDocument, import("mongoose").Model<SystemPromptDocument, any, any, any, Document<unknown, any, SystemPromptDocument, any> & SystemPromptDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SystemPromptDocument, Document<unknown, {}, import("mongoose").FlatRecord<SystemPromptDocument>, {}> & import("mongoose").FlatRecord<SystemPromptDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
