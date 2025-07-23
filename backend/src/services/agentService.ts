import { AgentModel, AgentTemplateModel, Agent, AgentTemplate, AgentTool, AgentToolType } from '../models/agent';
import { v4 as uuidv4 } from 'uuid';

export class AgentService {
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
      
      const agents = await AgentModel.find(query).exec();
      return agents;
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  public async getAgentById(agentId: string): Promise<Agent | null> {
    try {
      // Handle special case for default agent ID
      if (agentId === '000000000000000000000001') {
        return this.getDefaultAgent();
      }
      
      const agent = await AgentModel.findById(agentId);
      return agent;
    } catch (error) {
      console.error(`Error fetching agent ${agentId}:`, error);
      return null;
    }
  }

  private getDefaultAgent(): Agent {
    return new AgentModel({
      name: 'General Assistant',
      description: 'A helpful AI assistant for general questions and tasks',
      systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user\'s question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.',
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      collectionNames: [],
      tools: [
        { id: uuidv4(), name: 'Web Search', description: 'Search the web for current information', type: AgentToolType.WEB_SEARCH, config: {}, enabled: true },
        { id: uuidv4(), name: 'Calculator', description: 'Perform mathematical calculations', type: AgentToolType.CALCULATOR, config: {}, enabled: true },
        { id: uuidv4(), name: 'Current Date', description: 'Get the current date and time', type: AgentToolType.CURRENT_DATE, config: {}, enabled: true },
        { id: uuidv4(), name: 'Memory Search', description: 'Search through chat memory for relevant context', type: AgentToolType.MEMORY_SEARCH, config: {}, enabled: true },
        { id: uuidv4(), name: 'Memory Embed', description: 'Embed new message into chat memory', type: AgentToolType.MEMORY_EMBED, config: {}, enabled: true }
      ],
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
  }

  public async createAgent(agentData: any): Promise<Agent> {
    try {
      const agent = new AgentModel({
        name: agentData.name,
        description: agentData.description || '',
        systemPrompt: agentData.systemPrompt || '',
        modelId: agentData.modelId,
        collectionNames: agentData.collectionNames || [],
        tools: agentData.tools || [],
        temperature: agentData.temperature || 0.7,
        maxTokens: agentData.maxTokens || 4000,
        isPublic: agentData.isPublic || false,
        tags: agentData.tags || [],
        createdBy: agentData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        rating: 0.0
      });

      await agent.save();
      console.log(`✅ Created agent: ${agent.name}`);
      return agent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw new Error(`Failed to create agent: ${error}`);
    }
  }

  public async updateAgent(agentId: string, updates: any): Promise<Agent | null> {
    try {
      updates.updatedAt = new Date();
      
      const agent = await AgentModel.findByIdAndUpdate(
        agentId,
        { $set: updates },
        { new: true }
      );
      
      if (agent) {
        console.log(`✅ Updated agent: ${agent.name}`);
      }
      
      return agent;
    } catch (error) {
      console.error(`Error updating agent ${agentId}:`, error);
      return null;
    }
  }

  public async deleteAgent(agentId: string): Promise<boolean> {
    try {
      const result = await AgentModel.findByIdAndDelete(agentId);
      const success = !!result;
      
      if (success) {
        console.log(`🗑️ Deleted agent: ${result?.name}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error deleting agent ${agentId}:`, error);
      return false;
    }
  }

  public async getAgentTemplates(): Promise<AgentTemplate[]> {
    try {
      // Check if templates exist in database
      let templates = await AgentTemplateModel.find().exec();
      
      // If no templates in database, initialize with defaults
      if (templates.length === 0) {
        const defaultTemplates = this.getDefaultTemplates();
        await AgentTemplateModel.insertMany(defaultTemplates);
        templates = await AgentTemplateModel.find().exec();
      }
      
      return templates;
    } catch (error) {
      console.error('Error fetching agent templates:', error);
      return [];
    }
  }

  private getDefaultTemplates(): any[] {
    return [
      {
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
  }

  public async createAgentFromTemplate(templateId: string, customizations: any): Promise<Agent> {
    try {
      const template = await AgentTemplateModel.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const tools = this.createToolsFromRecommendations(template.recommendedTools);
      
      const agentData = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        systemPrompt: customizations.systemPrompt || template.systemPrompt,
        modelId: customizations.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: customizations.collectionNames || template.recommendedCollections,
        tools,
        temperature: customizations.temperature || 0.7,
        maxTokens: customizations.maxTokens || 4000,
        isPublic: customizations.isPublic || false,
        tags: customizations.tags || template.tags,
        createdBy: customizations.createdBy
      };

      return await this.createAgent(agentData);
    } catch (error) {
      console.error('Error creating agent from template:', error);
      throw new Error(`Failed to create agent from template: ${error}`);
    }
  }

  private createToolsFromRecommendations(recommendedTools: string[]): AgentTool[] {
    const toolMap: Record<string, AgentTool> = {
      web_search: {
        id: uuidv4(),
        name: 'Web Search',
        description: 'Search the web for current information',
        type: AgentToolType.WEB_SEARCH,
        config: {},
        enabled: true
      },
      calculator: {
        id: uuidv4(),
        name: 'Calculator',
        description: 'Perform mathematical calculations',
        type: AgentToolType.CALCULATOR,
        config: {},
        enabled: true
      }
    };

    return recommendedTools
      .map(toolName => toolMap[toolName])
      .filter(tool => tool !== undefined);
  }

  public async incrementUsageCount(agentId: string): Promise<void> {
    try {
      await AgentModel.findByIdAndUpdate(
        agentId,
        { $inc: { usageCount: 1 } }
      );
    } catch (error) {
      console.error(`Error incrementing usage count for agent ${agentId}:`, error);
    }
  }

  public async updateAgentRating(agentId: string, rating: number): Promise<void> {
    try {
      await AgentModel.findByIdAndUpdate(
        agentId,
        { $set: { rating } }
      );
    } catch (error) {
      console.error(`Error updating rating for agent ${agentId}:`, error);
    }
  }

  public async getPopularAgents(limit: number = 10): Promise<Agent[]> {
    try {
      const agents = await AgentModel.find({ isPublic: true })
        .sort({ usageCount: -1, rating: -1 })
        .limit(limit)
        .exec();
      
      return agents;
    } catch (error) {
      console.error('Error fetching popular agents:', error);
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

      const agents = await AgentModel.find(filter).exec();
      return agents;
    } catch (error) {
      console.error('Error searching agents:', error);
      return [];
    }
  }
}

// Export singleton instance
export const agentService = new AgentService(); 