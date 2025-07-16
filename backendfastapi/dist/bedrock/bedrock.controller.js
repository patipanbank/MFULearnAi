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
exports.BedrockController = void 0;
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("./bedrock.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let BedrockController = class BedrockController {
    bedrockService;
    constructor(bedrockService) {
        this.bedrockService = bedrockService;
    }
    async chat(body, req) {
        try {
            const { messages, systemPrompt, modelId, temperature, topP } = body;
            const userId = req.user.id;
            if (!messages || !Array.isArray(messages)) {
                throw new common_1.HttpException('Messages array is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const response = await this.bedrockService.converseStream(modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', messages, systemPrompt || '', undefined, temperature || 0.7, topP || 0.9);
            return {
                success: true,
                data: response,
                message: 'Chat response generated successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate chat response: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createEmbedding(body, req) {
        try {
            const { text, modelId } = body;
            const userId = req.user.id;
            if (!text) {
                throw new common_1.HttpException('Text is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const embedding = await this.bedrockService.createTextEmbedding(text);
            return {
                success: true,
                data: { embedding },
                message: 'Embedding created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create embedding: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createBatchEmbeddings(body, req) {
        try {
            const { texts, modelId } = body;
            const userId = req.user.id;
            if (!texts || !Array.isArray(texts)) {
                throw new common_1.HttpException('Texts array is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
            return {
                success: true,
                data: { embeddings },
                message: 'Batch embeddings created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create batch embeddings: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async generateImage(body, req) {
        try {
            const { prompt } = body;
            const userId = req.user.id;
            if (!prompt) {
                throw new common_1.HttpException('Prompt is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const image = await this.bedrockService.generateImage(prompt);
            return {
                success: true,
                data: { image },
                message: 'Image generated successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to generate image: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async invokeAgent(body, req) {
        try {
            const { agentId, agentAliasId, sessionId, input } = body;
            const userId = req.user.id;
            if (!agentId || !agentAliasId || !sessionId || !input?.text) {
                throw new common_1.HttpException('Agent ID, alias ID, session ID, and input text are required', common_1.HttpStatus.BAD_REQUEST);
            }
            const response = await this.bedrockService.invokeAgent(agentId, agentAliasId, sessionId, input);
            return {
                success: true,
                data: response,
                message: 'Agent invoked successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to invoke agent: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.BedrockController = BedrockController;
__decorate([
    (0, common_1.Post)('chat'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BedrockController.prototype, "chat", null);
__decorate([
    (0, common_1.Post)('embedding'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BedrockController.prototype, "createEmbedding", null);
__decorate([
    (0, common_1.Post)('batch-embedding'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BedrockController.prototype, "createBatchEmbeddings", null);
__decorate([
    (0, common_1.Post)('image-generation'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BedrockController.prototype, "generateImage", null);
__decorate([
    (0, common_1.Post)('agent/invoke'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BedrockController.prototype, "invokeAgent", null);
exports.BedrockController = BedrockController = __decorate([
    (0, common_1.Controller)('bedrock'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService])
], BedrockController);
//# sourceMappingURL=bedrock.controller.js.map