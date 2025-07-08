import { AgentService } from './agent.service';
import { StreamingAgentOrchestratorService } from './streaming-agent-orchestrator.service';
import { StreamingAgentExecutionRequest } from '../../common/schemas';
export declare class AgentController {
    private readonly agentService;
    private readonly streamingAgentOrchestratorService;
    constructor(agentService: AgentService, streamingAgentOrchestratorService: StreamingAgentOrchestratorService);
    findAll(): Promise<(import("mongoose").Document<unknown, {}, import("./agent.schema").AgentDocument, {}> & import("./agent.schema").AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    findOne(id: string): Promise<(import("mongoose").Document<unknown, {}, import("./agent.schema").AgentDocument, {}> & import("./agent.schema").AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    create(body: any): Promise<import("mongoose").Document<unknown, {}, import("./agent.schema").AgentDocument, {}> & import("./agent.schema").AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    update(id: string, body: any): Promise<(import("mongoose").Document<unknown, {}, import("./agent.schema").AgentDocument, {}> & import("./agent.schema").AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    remove(id: string): Promise<(import("mongoose").Document<unknown, {}, import("./agent.schema").AgentDocument, {}> & import("./agent.schema").AgentDocument & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }) | null>;
    executeStreaming(body: StreamingAgentExecutionRequest): Promise<any>;
    getStreamingStatus(sessionId: string): Promise<any>;
    cancelStreaming(sessionId: string): Promise<{
        message: string;
        sessionId: string;
    }>;
}
