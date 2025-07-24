import mongoose, { Document } from 'mongoose';
export declare enum AgentToolType {
    FUNCTION = "function",
    RETRIEVER = "retriever",
    WEB_SEARCH = "web_search",
    CALCULATOR = "calculator",
    CURRENT_DATE = "current_date",
    MEMORY_SEARCH = "memory_search",
    MEMORY_EMBED = "memory_embed"
}
export declare enum AgentExecutionStatus {
    IDLE = "idle",
    THINKING = "thinking",
    USING_TOOL = "using_tool",
    RESPONDING = "responding",
    ERROR = "error"
}
export interface AgentTool {
    id: string;
    name: string;
    description: string;
    type: AgentToolType;
    config: Record<string, any>;
    enabled: boolean;
}
export interface TokenUsage {
    input: number;
    output: number;
}
export interface AgentExecution {
    id: string;
    agentId: string;
    sessionId: string;
    status: AgentExecutionStatus;
    currentTool?: string;
    progress: number;
    startTime: Date;
    endTime?: Date;
    tokenUsage: TokenUsage;
}
export interface Agent extends Document {
    id: string;
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
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    rating: number;
}
export interface AgentTemplate extends Document {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    systemPrompt: string;
    recommendedTools: string[];
    recommendedCollections: string[];
    tags: string[];
}
export declare const AgentModel: mongoose.Model<Agent, {}, {}, {}, mongoose.Document<unknown, {}, Agent, {}> & Agent & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const AgentTemplateModel: mongoose.Model<AgentTemplate, {}, {}, {}, mongoose.Document<unknown, {}, AgentTemplate, {}> & AgentTemplate & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const AgentExecutionModel: mongoose.Model<AgentExecution, {}, {}, {}, mongoose.Document<unknown, {}, AgentExecution, {}> & AgentExecution & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, any>;
//# sourceMappingURL=agent.d.ts.map