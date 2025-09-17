import { AgentTemplate } from '../models/agent';
export declare class AgentService {
    constructor();
    canUserCreateAgent(user: any, permission: string): boolean;
    canUserAccessAgent(user: any, agent: any): boolean;
    canUserModifyAgent(user: any, agent: any): boolean;
    getAllAgents(userId?: string): Promise<any[]>;
    getAgentById(agentId: string): Promise<any | null>;
    private getDefaultAgent;
    createAgent(agentData: any, user?: any): Promise<any>;
    updateAgent(agentId: string, updates: any, userId?: string): Promise<any | null>;
    deleteAgent(agentId: string, userId?: string): Promise<boolean>;
    getAgentTemplates(): Promise<AgentTemplate[]>;
    private getDefaultTemplates;
    createAgentFromTemplate(templateId: string, customizations: any): Promise<any>;
    private createToolsFromRecommendations;
    getAvailableTools(): any[];
    private mapUnifiedTypeToAgentType;
    getToolStatistics(): any;
    incrementUsageCount(agentId: string): Promise<void>;
    updateAgentRating(agentId: string, rating: number): Promise<void>;
    getPopularAgents(limit?: number): Promise<any[]>;
    searchAgents(query: string, userId?: string): Promise<any[]>;
}
export declare const agentService: AgentService;
//# sourceMappingURL=agentService.d.ts.map