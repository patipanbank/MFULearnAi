import { Agent, AgentTemplate } from '../models/agent';
export declare class AgentService {
    constructor();
    getAllAgents(userId?: string): Promise<Agent[]>;
    getAgentById(agentId: string): Promise<Agent | null>;
    private getDefaultAgent;
    createAgent(agentData: any): Promise<Agent>;
    updateAgent(agentId: string, updates: any, userId?: string): Promise<Agent | null>;
    deleteAgent(agentId: string, userId?: string): Promise<boolean>;
    getAgentTemplates(): Promise<AgentTemplate[]>;
    private getDefaultTemplates;
    createAgentFromTemplate(templateId: string, customizations: any): Promise<Agent>;
    private createToolsFromRecommendations;
    incrementUsageCount(agentId: string): Promise<void>;
    updateAgentRating(agentId: string, rating: number): Promise<void>;
    getPopularAgents(limit?: number): Promise<Agent[]>;
    searchAgents(query: string, userId?: string): Promise<Agent[]>;
}
export declare const agentService: AgentService;
//# sourceMappingURL=agentService.d.ts.map