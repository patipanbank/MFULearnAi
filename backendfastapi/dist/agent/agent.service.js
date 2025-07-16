"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AgentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const agent_model_1 = require("../models/agent.model");
let AgentService = AgentService_1 = class AgentService {
    agentModel;
    logger = new common_1.Logger(AgentService_1.name);
    constructor(agentModel) {
        this.agentModel = agentModel;
    }
    async getAllAgents() {
        try {
            const agents = await this.agentModel.find().exec();
            return agents;
        }
        catch (error) {
            this.logger.error(`Failed to get all agents: ${error.message}`);
            throw error;
        }
    }
    async getAgentById(agentId, userId) {
        try {
            const agent = await this.agentModel.findById(agentId).exec();
            if (!agent) {
                return null;
            }
            if (userId && agent.userId && agent.userId.toString() !== userId) {
                this.logger.warn(`User ${userId} attempted to access agent ${agentId} owned by ${agent.userId}`);
                return null;
            }
            return agent;
        }
        catch (error) {
            this.logger.error(`Failed to get agent by ID: ${error.message}`);
            throw error;
        }
    }
    async createAgent(agentData) {
        try {
            const agent = new this.agentModel(agentData);
            const savedAgent = await agent.save();
            this.logger.log(`Created agent: ${savedAgent.id}`);
            return savedAgent;
        }
        catch (error) {
            this.logger.error(`Failed to create agent: ${error.message}`);
            throw error;
        }
    }
    async updateAgent(agentId, updates) {
        try {
            const agent = await this.agentModel.findByIdAndUpdate(agentId, { ...updates, updatedAt: new Date() }, { new: true }).exec();
            if (agent) {
                this.logger.log(`Updated agent: ${agentId}`);
            }
            return agent;
        }
        catch (error) {
            this.logger.error(`Failed to update agent: ${error.message}`);
            throw error;
        }
    }
    async deleteAgent(agentId) {
        try {
            const result = await this.agentModel.findByIdAndDelete(agentId).exec();
            const deleted = !!result;
            if (deleted) {
                this.logger.log(`Deleted agent: ${agentId}`);
            }
            return deleted;
        }
        catch (error) {
            this.logger.error(`Failed to delete agent: ${error.message}`);
            throw error;
        }
    }
    async incrementUsageCount(agentId) {
        try {
            await this.agentModel.findByIdAndUpdate(agentId, { $inc: { usageCount: 1 } }).exec();
            this.logger.log(`Incremented usage count for agent: ${agentId}`);
        }
        catch (error) {
            this.logger.error(`Failed to increment usage count: ${error.message}`);
            throw error;
        }
    }
    async getAgentsByUserId(userId) {
        try {
            const agents = await this.agentModel.find({ userId }).exec();
            return agents;
        }
        catch (error) {
            this.logger.error(`Failed to get agents by user ID: ${error.message}`);
            throw error;
        }
    }
    async getPublicAgents() {
        try {
            const agents = await this.agentModel.find({ isPublic: true }).exec();
            return agents;
        }
        catch (error) {
            this.logger.error(`Failed to get public agents: ${error.message}`);
            throw error;
        }
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = AgentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(agent_model_1.Agent.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], AgentService);
//# sourceMappingURL=agent.service.js.map