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
const streaming_agent_orchestrator_service_1 = require("./streaming-agent-orchestrator.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const zod_validation_pipe_1 = require("../../common/zod-validation.pipe");
const schemas_1 = require("../../common/schemas");
let AgentController = class AgentController {
    constructor(agentService, streamingAgentOrchestratorService) {
        this.agentService = agentService;
        this.streamingAgentOrchestratorService = streamingAgentOrchestratorService;
    }
    async findAll() {
        return this.agentService.findAll();
    }
    async findOne(id) {
        return this.agentService.findOne(id);
    }
    async create(body) {
        return this.agentService.create(body);
    }
    async update(id, body) {
        return this.agentService.update(id, body);
    }
    async remove(id) {
        return this.agentService.delete(id);
    }
    async executeStreaming(body) {
        return this.streamingAgentOrchestratorService.executeAgentStreaming(body);
    }
    async getStreamingStatus(sessionId) {
        return this.streamingAgentOrchestratorService.getStreamingStatus(sessionId);
    }
    async cancelStreaming(sessionId) {
        await this.streamingAgentOrchestratorService.cancelStreamingExecution(sessionId);
        return { message: 'Streaming execution cancelled', sessionId };
    }
};
exports.AgentController = AgentController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('execute-streaming'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.streamingAgentExecutionRequestSchema)),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "executeStreaming", null);
__decorate([
    (0, common_1.Get)('streaming-status/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "getStreamingStatus", null);
__decorate([
    (0, common_1.Post)('cancel-streaming/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AgentController.prototype, "cancelStreaming", null);
exports.AgentController = AgentController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('agents'),
    __metadata("design:paramtypes", [agent_service_1.AgentService,
        streaming_agent_orchestrator_service_1.StreamingAgentOrchestratorService])
], AgentController);
//# sourceMappingURL=agent.controller.js.map