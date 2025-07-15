import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from '../models/agent.model';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {}

  async getAllAgents(): Promise<Agent[]> {
    try {
      const agents = await this.agentModel.find().exec();
      return agents;
    } catch (error) {
      this.logger.error(`Failed to get all agents: ${error.message}`);
      throw error;
    }
  }

  async getAgentById(agentId: string, userId?: string): Promise<Agent | null> {
    try {
      const agent = await this.agentModel.findById(agentId).exec();
      
      if (!agent) {
        return null;
      }

      // If userId provided, check if user has access to this agent
      if (userId && agent.userId && agent.userId.toString() !== userId) {
        this.logger.warn(`User ${userId} attempted to access agent ${agentId} owned by ${agent.userId}`);
        return null;
      }

      return agent;
    } catch (error) {
      this.logger.error(`Failed to get agent by ID: ${error.message}`);
      throw error;
    }
  }

  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    try {
      const agent = new this.agentModel(agentData);
      const savedAgent = await agent.save();
      this.logger.log(`Created agent: ${savedAgent.id}`);
      return savedAgent;
    } catch (error) {
      this.logger.error(`Failed to create agent: ${error.message}`);
      throw error;
    }
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
    try {
      const agent = await this.agentModel.findByIdAndUpdate(
        agentId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      ).exec();
      
      if (agent) {
        this.logger.log(`Updated agent: ${agentId}`);
      }
      
      return agent;
    } catch (error) {
      this.logger.error(`Failed to update agent: ${error.message}`);
      throw error;
    }
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    try {
      const result = await this.agentModel.findByIdAndDelete(agentId).exec();
      const deleted = !!result;
      
      if (deleted) {
        this.logger.log(`Deleted agent: ${agentId}`);
      }
      
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete agent: ${error.message}`);
      throw error;
    }
  }

  async incrementUsageCount(agentId: string): Promise<void> {
    try {
      await this.agentModel.findByIdAndUpdate(
        agentId,
        { $inc: { usageCount: 1 } }
      ).exec();
      
      this.logger.log(`Incremented usage count for agent: ${agentId}`);
    } catch (error) {
      this.logger.error(`Failed to increment usage count: ${error.message}`);
      throw error;
    }
  }

  async getAgentsByUserId(userId: string): Promise<Agent[]> {
    try {
      const agents = await this.agentModel.find({ userId }).exec();
      return agents;
    } catch (error) {
      this.logger.error(`Failed to get agents by user ID: ${error.message}`);
      throw error;
    }
  }

  async getPublicAgents(): Promise<Agent[]> {
    try {
      const agents = await this.agentModel.find({ isPublic: true }).exec();
      return agents;
    } catch (error) {
      this.logger.error(`Failed to get public agents: ${error.message}`);
      throw error;
    }
  }
} 