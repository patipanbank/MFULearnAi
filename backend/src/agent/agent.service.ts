import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument, AgentTemplate, AgentExecution, AgentTool } from '../models/agent.model';
import { User } from '../models/user.model';
import { RedisService } from '../redis/redis.service';

export interface CreateAgentDto {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  collectionNames?: string[];
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateAgentDto {
  name?: string;
  description?: string;
  systemPrompt?: string;
  modelId?: string;
  collectionNames?: string[];
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;
  isPublic?: boolean;
  tags?: string[];
}

export interface GetAgentsQuery {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  modelId?: string;
  isPublic?: boolean;
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class AgentService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(AgentTemplate.name) private agentTemplateModel: Model<AgentTemplate>,
    @InjectModel(AgentExecution.name) private agentExecutionModel: Model<AgentExecution>,
    private redisService: RedisService,
  ) {}

  async createAgent(userId: string, createAgentDto: CreateAgentDto): Promise<Agent> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const agent = new this.agentModel({
        ...createAgentDto,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        rating: 0.0,
      });

      const savedAgent = await agent.save();
      
      // Cache agent in Redis
      await this.redisService.set(
        `agent:${savedAgent._id}`,
        JSON.stringify(savedAgent),
        3600 // 1 hour
      );

      return savedAgent;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create agent');
    }
  }

  async getAgents(query: GetAgentsQuery): Promise<{ agents: Agent[]; total: number }> {
    try {
      const filter: any = {};
      
      if (query.search) {
        filter.$or = [
          { name: { $regex: query.search, $options: 'i' } },
          { description: { $regex: query.search, $options: 'i' } },
          { tags: { $in: [new RegExp(query.search, 'i')] } },
        ];
      }

      if (query.tags && query.tags.length > 0) {
        filter.tags = { $in: query.tags };
      }

      if (query.modelId) {
        filter.modelId = query.modelId;
      }

      if (query.isPublic !== undefined) {
        filter.isPublic = query.isPublic;
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Build sort object
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
      const sort: any = { [sortBy]: sortOrder };

      const [agents, total] = await Promise.all([
        this.agentModel
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'username email')
          .exec(),
        this.agentModel.countDocuments(filter),
      ]);

      return { agents, total };
    } catch (error) {
      throw new BadRequestException('Failed to get agents');
    }
  }

  async getAgentById(agentId: string, userId?: string): Promise<Agent> {
    try {
      // Try to get from cache first
      const cachedAgent = await this.redisService.get(`agent:${agentId}`);
      if (cachedAgent) {
        const agent = JSON.parse(cachedAgent as string);
        
        // Check authorization even for cached agent
        if (userId && !agent.isPublic && agent.createdBy.toString() !== userId) {
          throw new ForbiddenException('Access denied. This agent is private.');
        }
        
        return agent;
      }

      const agent = await this.agentModel
        .findById(agentId)
        .populate('createdBy', 'username email')
        .exec();

      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Authorization check: user can only access public agents or their own agents
      if (userId && !agent.isPublic && agent.createdBy.toString() !== userId) {
        throw new ForbiddenException('Access denied. This agent is private.');
      }

      // Cache the agent
      await this.redisService.set(
        `agent:${agentId}`,
        JSON.stringify(agent),
        3600
      );

      return agent;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to get agent');
    }
  }

  async getUserAgents(userId: string, query: GetAgentsQuery): Promise<{ agents: Agent[]; total: number }> {
    const userQuery = { ...query, createdBy: userId };
    
    try {
      const filter: any = { createdBy: userId };
      
      if (query.search) {
        filter.$or = [
          { name: { $regex: query.search, $options: 'i' } },
          { description: { $regex: query.search, $options: 'i' } },
          { tags: { $in: [new RegExp(query.search, 'i')] } },
        ];
      }

      if (query.tags && query.tags.length > 0) {
        filter.tags = { $in: query.tags };
      }

      if (query.modelId) {
        filter.modelId = query.modelId;
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
      const sort: any = { [sortBy]: sortOrder };

      const [agents, total] = await Promise.all([
        this.agentModel
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.agentModel.countDocuments(filter),
      ]);

      return { agents, total };
    } catch (error) {
      throw new BadRequestException('Failed to get user agents');
    }
  }

  async updateAgent(agentId: string, userId: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
    try {
      const agent = await this.agentModel.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Check if user owns this agent
      if (agent.createdBy.toString() !== userId) {
        throw new ForbiddenException('You can only update your own agents');
      }

      Object.assign(agent, updateAgentDto);
      agent.updatedAt = new Date();

      const updatedAgent = await agent.save();

      // Update cache
      await this.redisService.set(
        `agent:${agentId}`,
        JSON.stringify(updatedAgent),
        3600
      );

      return updatedAgent;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to update agent');
    }
  }

  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      const agent = await this.agentModel.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Check if user owns this agent
      if (agent.createdBy.toString() !== userId) {
        throw new ForbiddenException('You can only delete your own agents');
      }

      await this.agentModel.findByIdAndDelete(agentId);
      
      // Remove from cache
      await this.redisService.del(`agent:${agentId}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete agent');
    }
  }

  async incrementUsageCount(agentId: string, userId?: string): Promise<void> {
    try {
      // First, get the agent to check authorization
      const agent = await this.agentModel.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Authorization check: user can only increment usage for public agents or their own agents
      if (userId && !agent.isPublic && agent.createdBy.toString() !== userId) {
        throw new ForbiddenException('Access denied. This agent is private.');
      }

      await this.agentModel.findByIdAndUpdate(
        agentId,
        { 
          $inc: { usageCount: 1 },
          updatedAt: new Date()
        }
      );
      
      // Invalidate cache
      await this.redisService.del(`agent:${agentId}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      // Don't throw error for usage count - it's not critical
      console.error('Failed to increment usage count:', error);
    }
  }

  async getAgentTemplates(): Promise<AgentTemplate[]> {
    try {
      return await this.agentTemplateModel.find().exec();
    } catch (error) {
      throw new BadRequestException('Failed to get agent templates');
    }
  }

  async getPublicAgents(query: GetAgentsQuery): Promise<{ agents: Agent[]; total: number }> {
    const publicQuery = { ...query, isPublic: true };
    return this.getAgents(publicQuery);
  }

  async getAgentStats(agentId: string): Promise<any> {
    try {
      const agent = await this.getAgentById(agentId);
      
      const stats = {
        totalUsage: agent.usageCount,
        rating: agent.rating,
        toolsCount: agent.tools.length,
        collectionsCount: agent.collectionNames.length,
        isPublic: agent.isPublic,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      };

      return stats;
    } catch (error) {
      throw new BadRequestException('Failed to get agent stats');
    }
  }

  async searchAgents(searchTerm: string, limit: number = 10): Promise<Agent[]> {
    try {
      return await this.agentModel
        .find({
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { tags: { $in: [new RegExp(searchTerm, 'i')] } },
          ],
          isPublic: true,
        })
        .limit(limit)
        .sort({ usageCount: -1, rating: -1 })
        .exec();
    } catch (error) {
      throw new BadRequestException('Failed to search agents');
    }
  }

  async rateAgent(agentId: string, userId: string, rating: number): Promise<Agent> {
    try {
      // Validate rating range
      if (rating < 0 || rating > 5) {
        throw new BadRequestException('Rating must be between 0 and 5');
      }

      const agent = await this.agentModel.findById(agentId);
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      // Check if user has access to this agent
      if (!agent.isPublic && agent.createdBy.toString() !== userId) {
        throw new ForbiddenException('Access denied');
      }

      // For now, we'll use a simple rating system
      // In a more sophisticated system, you might store individual ratings
      // and calculate averages, but for simplicity, we'll update the rating directly
      
      // Simple approach: weighted average of current rating and new rating
      const currentUsageCount = agent.usageCount || 0;
      const currentRating = agent.rating || 0;
      
      // Calculate new average rating
      // If this is the first rating, use the new rating
      // Otherwise, calculate weighted average
      let newRating: number;
      if (currentUsageCount === 0 || currentRating === 0) {
        newRating = rating;
      } else {
        // Weighted average: give more weight to more recent ratings
        const weight = Math.min(currentUsageCount, 10); // Cap weight at 10
        newRating = (currentRating * weight + rating) / (weight + 1);
      }

      // Update agent rating
      agent.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal place
      agent.updatedAt = new Date();

      const savedAgent = await agent.save();

      // Update Redis cache
      await this.redisService.set(
        `agent:${agentId}`,
        JSON.stringify(savedAgent),
        3600
      );

      return savedAgent;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to rate agent');
    }
  }

  async getAgentRating(agentId: string): Promise<{ rating: number; usageCount: number }> {
    try {
      const agent = await this.agentModel.findById(agentId, 'rating usageCount');
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }

      return {
        rating: agent.rating || 0,
        usageCount: agent.usageCount || 0,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to get agent rating');
    }
  }

  async createAgentFromTemplate(
    templateId: string,
    userId: string,
    customizations: any,
  ): Promise<Agent> {
    try {
      // Get template from database first
      let template = await this.agentTemplateModel.findOne({ _id: templateId });
      
      if (!template) {
        // Fallback to hardcoded templates (like in AgentStore frontend)
        const hardcodedTemplates = [
          {
            id: 'programming-assistant',
            name: 'Programming Assistant',
            description: 'Expert in programming languages, debugging, and code review',
            category: 'Development',
            systemPrompt: 'You are an expert programming assistant. Help users with coding questions, debugging, code review, and software development best practices. Provide clear, practical solutions with examples.',
            recommendedTools: ['web_search', 'calculator'],
            recommendedCollections: ['programming-docs', 'api-documentation'],
            tags: ['programming', 'coding', 'development']
          },
          {
            id: 'academic-tutor',
            name: 'Academic Tutor',
            description: 'Specialized in academic subjects and research assistance',
            category: 'Education',
            systemPrompt: 'You are an academic tutor. Provide clear explanations, help students understand complex concepts, and assist with research. Use evidence-based information and cite sources when appropriate.',
            recommendedTools: ['web_search'],
            recommendedCollections: ['academic-papers', 'textbooks', 'research-data'],
            tags: ['education', 'academic', 'research']
          },
          {
            id: 'data-analyst',
            name: 'Data Analyst',
            description: 'Analyzes data and generates insights with visualizations',
            category: 'Analytics',
            systemPrompt: 'You are a data analyst. Help users analyze data, create visualizations, interpret statistics, and generate actionable insights. Explain methodologies and provide data-driven recommendations.',
            recommendedTools: ['calculator', 'web_search'],
            recommendedCollections: ['datasets', 'analytics-guides'],
            tags: ['data', 'analytics', 'statistics']
          },
          {
            id: 'content-writer',
            name: 'Content Writer',
            description: 'Creates engaging content and copy for various purposes',
            category: 'Content',
            systemPrompt: 'You are a professional content writer. Create engaging, well-structured content for various purposes including articles, marketing copy, social media posts, and documentation. Adapt your tone and style to the target audience.',
            recommendedTools: ['web_search'],
            recommendedCollections: ['writing-guides', 'style-guides'],
            tags: ['writing', 'content', 'marketing']
          }
        ];

        const hardcodedTemplate = hardcodedTemplates.find(t => t.id === templateId);
        if (!hardcodedTemplate) {
          throw new NotFoundException('Template not found');
        }

        // Convert hardcoded template to template format
        template = {
          ...hardcodedTemplate,
          _id: templateId,
        } as any;
      }

      // Ensure template exists at this point
      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Create agent data from template
      const agentData: CreateAgentDto = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        systemPrompt: customizations.systemPrompt || template.systemPrompt,
        modelId: customizations.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: customizations.collectionNames || (template as any).recommendedCollections || [],
        tools: customizations.tools || this.convertRecommendedToolsToTools((template as any).recommendedTools || []),
        temperature: customizations.temperature || 0.7,
        maxTokens: customizations.maxTokens || 4000,
        isPublic: customizations.isPublic || false,
        tags: customizations.tags || template.tags || [],
      };

      // Create the agent
      return await this.createAgent(userId, agentData);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create agent from template');
    }
  }

  private convertRecommendedToolsToTools(recommendedTools: string[]): AgentTool[] {
    const toolMap: { [key: string]: AgentTool } = {
      'web_search': {
        id: 'web_search',
        name: 'Web Search',
        description: 'Search the web for current information',
        type: 'web_search' as any,
        config: {},
        enabled: true,
      },
      'calculator': {
        id: 'calculator',
        name: 'Calculator',
        description: 'Perform mathematical calculations',
        type: 'calculator' as any,
        config: {},
        enabled: true,
      },
      'retriever': {
        id: 'retriever',
        name: 'Knowledge Retriever',
        description: 'Retrieve information from knowledge base',
        type: 'retriever' as any,
        config: {},
        enabled: true,
      },
    };

    return recommendedTools
      .map(toolName => toolMap[toolName])
      .filter(tool => tool !== undefined);
  }
} 