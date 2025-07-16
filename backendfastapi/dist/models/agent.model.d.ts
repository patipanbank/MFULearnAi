import { Document, Types } from 'mongoose';
export type AgentDocument = Agent & Document;
export declare enum AgentToolType {
    FUNCTION = "function",
    RETRIEVER = "retriever",
    WEB_SEARCH = "web_search",
    CALCULATOR = "calculator"
}
export declare class AgentTool {
    id: string;
    name: string;
    description: string;
    type: AgentToolType;
    config: any;
    enabled: boolean;
}
export declare const AgentToolSchema: import("mongoose").Schema<AgentTool, import("mongoose").Model<AgentTool, any, any, any, Document<unknown, any, AgentTool, any> & AgentTool & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentTool, Document<unknown, {}, import("mongoose").FlatRecord<AgentTool>, {}> & import("mongoose").FlatRecord<AgentTool> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare enum AgentExecutionStatus {
    IDLE = "idle",
    THINKING = "thinking",
    USING_TOOL = "using_tool",
    RESPONDING = "responding",
    ERROR = "error"
}
export declare class TokenUsage {
    input: number;
    output: number;
}
export declare const TokenUsageSchema: import("mongoose").Schema<TokenUsage, import("mongoose").Model<TokenUsage, any, any, any, Document<unknown, any, TokenUsage, any> & TokenUsage & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, TokenUsage, Document<unknown, {}, import("mongoose").FlatRecord<TokenUsage>, {}> & import("mongoose").FlatRecord<TokenUsage> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class AgentExecution {
    id: string;
    agentId: Types.ObjectId;
    sessionId: string;
    status: AgentExecutionStatus;
    currentTool?: string;
    progress: number;
    startTime: Date;
    endTime?: Date;
    tokenUsage: TokenUsage;
}
export declare const AgentExecutionSchema: import("mongoose").Schema<AgentExecution, import("mongoose").Model<AgentExecution, any, any, any, Document<unknown, any, AgentExecution, any> & AgentExecution & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentExecution, Document<unknown, {}, import("mongoose").FlatRecord<AgentExecution>, {}> & import("mongoose").FlatRecord<AgentExecution> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class Agent {
    name: string;
    description: string;
    systemPrompt: string;
    modelId: string;
    collectionNames: string[];
    tools: AgentTool[];
    temperature: number;
    maxTokens: number;
    isPublic: boolean;
    tags: string[];
    createdBy: Types.ObjectId;
    userId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    rating: number;
}
export declare const AgentSchema: import("mongoose").Schema<Agent, import("mongoose").Model<Agent, any, any, any, Document<unknown, any, Agent, any> & Agent & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Agent, Document<unknown, {}, import("mongoose").FlatRecord<Agent>, {}> & import("mongoose").FlatRecord<Agent> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
export declare class AgentTemplate {
    name: string;
    description: string;
    category: string;
    icon: string;
    systemPrompt: string;
    recommendedTools: string[];
    recommendedCollections: string[];
    tags: string[];
}
export declare const AgentTemplateSchema: import("mongoose").Schema<AgentTemplate, import("mongoose").Model<AgentTemplate, any, any, any, Document<unknown, any, AgentTemplate, any> & AgentTemplate & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AgentTemplate, Document<unknown, {}, import("mongoose").FlatRecord<AgentTemplate>, {}> & import("mongoose").FlatRecord<AgentTemplate> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>;
