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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let AgentController = class AgentController {
    agentService;
    constructor(agentService) {
        this.agentService = agentService;
    }
    async getAllAgents(req) {
        try {
            const agents = await this.agentService.getAllAgents();
            return {
                success: true,
                data: agents,
                message: 'Agents retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get agents: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getPublicAgents() {
        try {
            const agents = await this.agentService.getPublicAgents();
            return {
                success: true,
                data: agents,
                message: 'Public agents retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get public agents: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getMyAgents(req) {
        try {
            const userId = req.user.id;
            const agents = await this.agentService.getAgentsByUserId(userId);
            return {
                success: true,
                data: agents,
                message: 'User agents retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get user agents: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAgentById(agentId, req) {
        try {
            const userId = req.user.id;
            const agent = await this.agentService.getAgentById(agentId, userId);
            if (!agent) {
                throw new common_1.HttpException('Agent not found or access denied', common_1.HttpStatus.NOT_FOUND);
            }
            return {
                success: true,
                data: agent,
                message: 'Agent retrieved successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to get agent: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createAgent(createAgentDto, req) {
        try {
            const userId = req.user.id;
            const agentData = {
                ...createAgentDto,
                createdBy: userId,
                userId: userId,
            };
            const agent = await this.agentService.createAgent(agentData);
            return {
                success: true,
                data: agent,
                message: 'Agent created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create agent: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateAgent(agentId, updateAgentDto, req) {
        try {
            const userId = req.user.id;
            const agent = await this.agentService.getAgentById(agentId, userId);
            if (!agent) {
                throw new common_1.HttpException('Agent not found or access denied', common_1.HttpStatus.NOT_FOUND);
            }
            const updatedAgent = await this.agentService.updateAgent(agentId, updateAgentDto);
            return {
                success: true,
                data: updatedAgent,
                message: 'Agent updated successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to update agent: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async deleteAgent(agentId, req) {
        try {
            const userId = req.user.id;
            const agent = await this.agentService.getAgentById(agentId, userId);
            if (!agent) {
                throw new common_1.HttpException('Agent not found or access denied', common_1.HttpStatus.NOT_FOUND);
            }
            const deleted = await this.agentService.deleteAgent(agentId);
            if (!deleted) {
                throw new common_1.HttpException('Failed to delete agent', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            return {
                success: true,
                message: 'Agent deleted successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to delete agent: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async incrementUsageCount(agentId, req) {
        try {
            const userId = req.user.id;
            const agent = await this.agentService.getAgentById(agentId, userId);
            if (!agent) {
                throw new common_1.HttpException('Agent not found or access denied', common_1.HttpStatus.NOT_FOUND);
            }
            await this.agentService.incrementUsageCount(agentId);
            return {
                success: true,
                message: 'Agent usage count incremented successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to increment usage count: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.AgentController = AgentController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAllAgents", null);
__decorate([
    (0, common_1.Get)('public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getPublicAgents", null);
__decorate([
    (0, common_1.Get)('my'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getMyAgents", null);
__decorate([
    (0, common_1.Get)(':agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getAgentById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "createAgent", null);
__decorate([
    (0, common_1.Put)(':agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "updateAgent", null);
__decorate([
    (0, common_1.Delete)(':agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "deleteAgent", null);
__decorate([
    (0, common_1.Post)(':agentId/increment-usage'),
    __param(0, (0, common_1.Param)('agentId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "incrementUsageCount", null);
exports.AgentController = AgentController = __decorate([
    (0, common_1.Controller)('agents'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [agent_service_1.AgentService])
], AgentController);
//# sourceMappingURL=agent.controller.js.map