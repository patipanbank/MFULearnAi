import { Model } from 'mongoose';
import { AgentDocument } from './agent.schema';
export declare class AgentService {
    private readonly agentModel;
    constructor(agentModel: Model<AgentDocument>);
    findAll(): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[], import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentDocument, "find", {}>;
    findOne(id: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null, import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentDocument, "findOne", {}>;
    create(data: Partial<AgentDocument>): Promise<import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    update(id: string, data: Partial<AgentDocument>): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null, import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentDocument, "findOneAndUpdate", {}>;
    delete(id: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null, import("mongoose").Document<unknown, {}, AgentDocument, {}> & AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }, {}, AgentDocument, "findOneAndDelete", {}>;
}
