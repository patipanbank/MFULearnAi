import { Model } from 'mongoose';
import { Agent, AgentDocument } from '../models/agent.model';
export declare class AgentService {
    private agentModel;
    private readonly logger;
    constructor(agentModel: Model<AgentDocument>);
    getAllAgents(): Promise<Agent[]>;
    getAgentById(agentId: string, userId?: string): Promise<Agent | null>;
    createAgent(agentData: Partial<Agent>): Promise<Agent>;
    updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null>;
    deleteAgent(agentId: string): Promise<boolean>;
    incrementUsageCount(agentId: string): Promise<void>;
    getAgentsByUserId(userId: string): Promise<Agent[]>;
    getPublicAgents(): Promise<Agent[]>;
}
