import { Agent } from '../models/agent';
export interface AgentTemplate {
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
export declare class AgentService {
    private defaultTemplates;
    constructor();
    getAllAgents(userId?: string): Promise<Agent[]>;
    getAgentById(agentId: string): Promise<Agent | null>;
    createAgent(agentData: Partial<Agent>): Promise<Agent>;
    updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null>;
    deleteAgent(agentId: string): Promise<boolean>;
    getAgentTemplates(): Promise<AgentTemplate[]>;
    createAgentFromTemplate(templateId: string, customizations: Partial<Agent>): Promise<Agent>;
    incrementUsageCount(agentId: string): Promise<void>;
    updateAgentRating(agentId: string, rating: number): Promise<void>;
    getPopularAgents(limit?: number): Promise<Agent[]>;
    searchAgents(query: string, userId?: string): Promise<Agent[]>;
}
export declare const agentService: AgentService;
//# sourceMappingURL=agentService.d.ts.map