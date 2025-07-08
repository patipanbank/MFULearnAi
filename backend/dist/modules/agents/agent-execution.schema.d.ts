import { Schema, Document } from 'mongoose';
export declare enum AgentExecutionStatus {
    IDLE = "idle",
    THINKING = "thinking",
    USING_TOOL = "using_tool",
    RESPONDING = "responding",
    ERROR = "error"
}
export interface AgentExecutionDocument extends Document {
    agentId: string;
    sessionId: string;
    status: AgentExecutionStatus;
    currentTool?: string;
    progress: number;
    startTime: Date;
    endTime?: Date;
    tokenUsage: {
        input: number;
        output: number;
    };
}
export declare const AgentExecutionSchema: Schema<AgentExecutionDocument, import("mongoose").Model<AgentExecutionDocument, any, any, any, Document<unknown, any, AgentExecutionDocument, any> & AgentExecutionDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentExecutionDocument, Document<unknown, {}, import("mongoose").FlatRecord<AgentExecutionDocument>, {}> & import("mongoose").FlatRecord<AgentExecutionDocument> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
