import { AgentService } from './agent.service';
export declare class AgentController {
    private agentService;
    constructor(agentService: AgentService);
    getAllAgents(req: any): Promise<any>;
    getPublicAgents(): Promise<any>;
    getMyAgents(req: any): Promise<any>;
    getAgentById(agentId: string, req: any): Promise<any>;
    createAgent(createAgentDto: any, req: any): Promise<any>;
    updateAgent(agentId: string, updateAgentDto: any, req: any): Promise<any>;
    deleteAgent(agentId: string, req: any): Promise<any>;
    incrementUsageCount(agentId: string, req: any): Promise<any>;
}
