import { AgentModel, Agent } from '../models/agent';

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

export class AgentService {
  private defaultTemplates: AgentTemplate[] = [
    {
      id: 'programming-assistant',
      name: 'Programming Assistant',
      description: 'Expert in programming languages, debugging, and code review',
      category: 'Development',
      icon: '💻',
      systemPrompt: 'You are an expert programming assistant. Help users with coding questions, debugging, code review, and software development best practices. Provide clear, practical solutions with examples. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
      recommendedTools: ['web_search', 'calculator'],
      recommendedCollections: ['programming-docs', 'api-documentation'],
      tags: ['programming', 'coding', 'development']
    },
    {
      id: 'academic-tutor',
      name: 'Academic Tutor',
      description: 'Specialized in academic subjects and research assistance',
      category: 'Education',
      icon: '🎓',
      systemPrompt: 'You are an academic tutor. Provide clear explanations, help students understand complex concepts, and assist with research. Use evidence-based information and cite sources when appropriate. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
      recommendedTools: ['web_search'],
      recommendedCollections: ['academic-papers', 'textbooks', 'research-data'],
      tags: ['education', 'academic', 'research']
    },
    {
      id: 'writing-assistant',
      name: 'Writing Assistant',
      description: 'Professional writing and content creation support',
      category: 'Content',
      icon: '✍️',
      systemPrompt: 'You are a professional writing assistant. Help users with content creation, editing, proofreading, and improving writing style. Provide constructive feedback and suggestions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
      recommendedTools: ['web_search'],
      recommendedCollections: ['writing-guides', 'style-manuals'],
      tags: ['writing', 'content', 'editing']
    }
  ];

  constructor() {
    console.log('✅ Agent service initialized');
  }

  public async getAllAgents(userId?: string): Promise<Agent[]> {
    try {
      let query = {};
      if (userId) {
        query = {
          $or: [
            { createdBy: userId },
            { isPublic: true }
          ]
        };
      }

      const agents = await AgentModel.find(query).sort({ createdAt: -1 });
      return agents;
    } catch (error) {
      console.error('❌ Error fetching agents:', error);
      return [];
    }
  }

  public async getAgentById(agentId: string): Promise<Agent | null> {
    try {
      // Handle special case for default agent ID
      if (agentId === '000000000000000000000001') {
        const defaultAgent = new AgentModel({
          name: 'General Assistant',
          description: 'A helpful AI assistant for general questions and tasks',
          systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
          modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          collectionNames: [],
          tools: [],
          temperature: 0.7,
          maxTokens: 4000,
          isPublic: true,
          tags: ['general', 'assistant'],
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          rating: 0.0
        });
        return defaultAgent;
      }

      const agent = await AgentModel.findById(agentId);
      return agent;
    } catch (error) {
      console.error(`❌ Error fetching agent ${agentId}:`, error);
      return null;
    }
  }

  public async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    try {
      const agent = new AgentModel({
        ...agentData,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        rating: 0.0
      });

      await agent.save();
      console.log(`✅ Created agent: ${agent.name}`);
      return agent;
    } catch (error) {
      console.error('❌ Error creating agent:', error);
      throw new Error(`Failed to create agent: ${error}`);
    }
  }

  public async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
    try {
      const agent = await AgentModel.findByIdAndUpdate(
        agentId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      );

      if (agent) {
        console.log(`✅ Updated agent: ${agent.name}`);
      }

      return agent;
    } catch (error) {
      console.error(`❌ Error updating agent ${agentId}:`, error);
      return null;
    }
  }

  public async deleteAgent(agentId: string): Promise<boolean> {
    try {
      const result = await AgentModel.findByIdAndDelete(agentId);
      const success = !!result;
      
      if (success) {
        console.log(`🗑️ Deleted agent: ${agentId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Error deleting agent ${agentId}:`, error);
      return false;
    }
  }

  public async getAgentTemplates(): Promise<AgentTemplate[]> {
    return this.defaultTemplates;
  }

  public async createAgentFromTemplate(templateId: string, customizations: Partial<Agent>): Promise<Agent> {
    const template = this.defaultTemplates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const agentData: Partial<Agent> = {
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      systemPrompt: customizations.systemPrompt || template.systemPrompt,
      modelId: customizations.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      collectionNames: customizations.collectionNames || template.recommendedCollections,
      tools: customizations.tools || [],
      temperature: customizations.temperature || 0.7,
      maxTokens: customizations.maxTokens || 4000,
      isPublic: customizations.isPublic || false,
      tags: customizations.tags || template.tags,
      createdBy: customizations.createdBy || 'system'
    };

    return this.createAgent(agentData);
  }

  public async incrementUsageCount(agentId: string): Promise<void> {
    try {
      await AgentModel.findByIdAndUpdate(agentId, {
        $inc: { usageCount: 1 },
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Error incrementing usage count for agent ${agentId}:`, error);
    }
  }

  public async updateAgentRating(agentId: string, rating: number): Promise<void> {
    try {
      await AgentModel.findByIdAndUpdate(agentId, {
        rating,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Error updating rating for agent ${agentId}:`, error);
    }
  }

  public async getPopularAgents(limit: number = 10): Promise<Agent[]> {
    try {
      const agents = await AgentModel.find({ isPublic: true })
        .sort({ usageCount: -1, rating: -1 })
        .limit(limit);
      
      return agents;
    } catch (error) {
      console.error('❌ Error fetching popular agents:', error);
      return [];
    }
  }

  public async searchAgents(query: string, userId?: string): Promise<Agent[]> {
    try {
      let filter: any = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      };

      if (userId) {
        filter.$or = [
          { createdBy: userId },
          { isPublic: true }
        ];
      }

      const agents = await AgentModel.find(filter);
      return agents;
    } catch (error) {
      console.error('❌ Error searching agents:', error);
      return [];
    }
  }
}

export const agentService = new AgentService(); 