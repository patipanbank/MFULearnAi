import { Schema, Document } from 'mongoose';
export interface AgentDocument extends Document {
    name: string;
    description: string;
    systemPrompt: string;
    modelId: string;
    collectionNames: string[];
    temperature: number;
    maxTokens: number;
    isPublic: boolean;
    tags: string[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AgentSchema: Schema<AgentDocument, import("mongoose").Model<AgentDocument, any, any, any, Document<unknown, any, AgentDocument, any> & AgentDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentDocument, Document<unknown, {}, import("mongoose").FlatRecord<AgentDocument>, {}> & import("mongoose").FlatRecord<AgentDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
