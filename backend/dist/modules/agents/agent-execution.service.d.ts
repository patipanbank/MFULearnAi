import { Model } from 'mongoose';
import { AgentExecutionDocument, AgentExecutionStatus } from './agent-execution.schema';
export declare class AgentExecutionService {
    private readonly model;
    constructor(model: Model<AgentExecutionDocument>);
    createExecution(agentId: string, sessionId: string): Promise<import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateStatus(id: string, status: AgentExecutionStatus, extra?: Partial<AgentExecutionDocument>): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null, import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentExecutionDocument, "findOneAndUpdate", {}>;
    finish(id: string, tokenUsage: {
        input: number;
        output: number;
    }): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null, import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentExecutionDocument, "findOneAndUpdate", {}>;
    findBySession(sessionId: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[], import("mongoose").Document<unknown, {}, AgentExecutionDocument, {}> & AgentExecutionDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentExecutionDocument, "find", {}>;
}
