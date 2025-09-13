import { AgentTemplate } from '../models/agent';
export declare class AgentService {
    constructor();
    getAllAgents(userId?: string): Promise<any[]>;
    getAgentById(agentId: string): Promise<any | null>;
    private getDefaultAgent;
    createAgent(agentData: any): Promise<any>;
    updateAgent(agentId: string, updates: any, userId?: string): Promise<any | null>;
    deleteAgent(agentId: string, userId?: string): Promise<boolean>;
    getAgentTemplates(): Promise<AgentTemplate[]>;
    private getDefaultTemplates;
    createAgentFromTemplate(templateId: string, customizations: any): Promise<any>;
    private createToolsFromRecommendations;
    incrementUsageCount(agentId: string): Promise<void>;
    updateAgentRating(agentId: string, rating: number): Promise<void>;
    getPopularAgents(limit?: number): Promise<any[]>;
    searchAgents(query: string, userId?: string): Promise<any[]>;
    getUserAgents(userId: string, options?: any): Promise<any[]>;
    getPublicAgents(options?: any): Promise<any[]>;
    getAgent(agentId: string, userId?: string): Promise<any>;
    cloneAgent(agentId: string, userId: string): Promise<any>;
    testAgent(agentId: string, testInput: any): Promise<any>;
    getAgentStats(agentId: string): Promise<any>;
}
export declare const agentService: AgentService;
//# sourceMappingURL=agentService.d.ts.map