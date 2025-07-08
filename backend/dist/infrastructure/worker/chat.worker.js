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
var ChatWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatWorker = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chat_service_1 = require("../../modules/chat/chat.service");
const ioredis_1 = require("ioredis");
const memory_service_1 = require("../../services/memory.service");
const agent_execution_service_1 = require("../../modules/agents/agent-execution.service");
const agent_orchestrator_service_1 = require("../../modules/agents/agent-orchestrator.service");
const agent_service_1 = require("../../modules/agents/agent.service");
let ChatWorker = ChatWorker_1 = class ChatWorker extends bullmq_1.WorkerHost {
    constructor(bedrockService, chatService, execService, agentOrchestratorService, agentService, redis, memoryService) {
        super();
        this.bedrockService = bedrockService;
        this.chatService = chatService;
        this.execService = execService;
        this.agentOrchestratorService = agentOrchestratorService;
        this.agentService = agentService;
        this.redis = redis;
        this.memoryService = memoryService;
        this.logger = new common_1.Logger(ChatWorker_1.name);
    }
    async process(job) {
        const payload = job.data;
        const channel = `chat:${payload.sessionId}`;
        this.logger.log(`🔄 Processing chat job for session: ${payload.sessionId}`);
        try {
            if (payload.agentId) {
                await this.processWithAgent(payload, channel);
            }
            else {
                await this.processWithSimpleLLM(payload, channel);
            }
            await this.redis.publish(channel, JSON.stringify({ type: 'end' }));
            this.logger.log(`✅ Chat job completed for session: ${payload.sessionId}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Chat job failed for session ${payload.sessionId}:`, errorMessage);
            await this.redis.publish(channel, JSON.stringify({
                type: 'error',
                data: { message: 'An error occurred while processing your message' }
            }));
            throw error;
        }
    }
    async processWithAgent(payload, channel) {
        const { agentId, sessionId, userId, message } = payload;
        this.logger.log(`🤖 Processing with agent: ${agentId}`);
        const agent = await this.agentService.findOne(agentId);
        if (!agent) {
            throw new Error(`Agent with ID ${agentId} not found`);
        }
        const chat = await this.chatService.getChatById(sessionId);
        const context = ((chat === null || chat === void 0 ? void 0 : chat.messages) || []).slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
        }));
        await this.redis.publish(channel, JSON.stringify({
            type: 'status',
            data: { status: 'thinking', message: 'Agent is processing your request...' }
        }));
        try {
            const agentResult = await this.agentOrchestratorService.executeAgent({
                agentId: agentId,
                sessionId,
                userId,
                message,
                context
            });
            if (agentResult.toolsUsed.length > 0) {
                await this.redis.publish(channel, JSON.stringify({
                    type: 'tools_used',
                    data: {
                        tools: agentResult.toolsUsed,
                        message: `Used tools: ${agentResult.toolsUsed.join(', ')}`
                    }
                }));
            }
            await this.streamResponse(agentResult.response, channel);
            await this.chatService.addMessage(sessionId, {
                role: 'assistant',
                content: agentResult.response,
                timestamp: new Date(),
            });
            await this.redis.publish(channel, JSON.stringify({
                type: 'token_usage',
                data: agentResult.tokenUsage
            }));
        }
        catch (error) {
            this.logger.error(`Agent execution failed: ${error}`);
            throw error;
        }
    }
    async processWithSimpleLLM(payload, channel) {
        var _a, _b, _c, _d;
        this.logger.log(`🧠 Processing with simple LLM`);
        const chat = await this.chatService.getChatById(payload.sessionId);
        const history = ((chat === null || chat === void 0 ? void 0 : chat.messages) || []).slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
        }));
        history.push({ role: 'user', content: payload.message });
        let finalSystemPrompt = payload.systemPrompt || 'You are a helpful AI assistant.';
        try {
            const memRes = await this.memoryService.searchChatMemory(payload.sessionId, payload.message, 5);
            const docs = (_b = (_a = memRes === null || memRes === void 0 ? void 0 : memRes.documents) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : [];
            if (docs.length > 0) {
                const context = docs.map((d) => `- ${d}`).join('\n');
                const ctxBlock = `\n\nRelevant past context:\n${context}`;
                finalSystemPrompt = finalSystemPrompt + ctxBlock;
            }
        }
        catch (err) {
            this.logger.warn('Memory search error:', err);
        }
        await this.redis.publish(channel, JSON.stringify({
            type: 'status',
            data: { status: 'generating', message: 'Generating response...' }
        }));
        const stream = await this.bedrockService.converseStream({
            modelId: payload.modelId,
            messages: history,
            systemPrompt: finalSystemPrompt,
            temperature: payload.temperature,
            maxTokens: payload.maxTokens,
        });
        const buffer = [];
        for await (const chunk of stream) {
            let content;
            if (typeof chunk === 'string') {
                content = chunk;
            }
            else if (chunk === null || chunk === void 0 ? void 0 : chunk.data) {
                content = chunk.data;
            }
            else if ((_c = chunk === null || chunk === void 0 ? void 0 : chunk.delta) === null || _c === void 0 ? void 0 : _c.text) {
                content = chunk.delta.text;
            }
            if (!content)
                continue;
            buffer.push(content);
            await this.redis.publish(channel, JSON.stringify({ type: 'chunk', data: content }));
        }
        const finalText = buffer.join('');
        await this.chatService.addMessage(payload.sessionId, {
            role: 'assistant',
            content: finalText,
            timestamp: new Date(),
        });
        const updatedChat = await this.chatService.getChatById(payload.sessionId);
        const messageCount = (_d = updatedChat === null || updatedChat === void 0 ? void 0 : updatedChat.messages.length) !== null && _d !== void 0 ? _d : 0;
        if (messageCount > 0 && messageCount % 10 === 0) {
            await this.embedChatHistory(payload.sessionId, updatedChat);
        }
    }
    async streamResponse(response, channel) {
        const words = response.split(' ');
        const chunkSize = 5;
        for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            await this.redis.publish(channel, JSON.stringify({ type: 'chunk', data: chunk + ' ' }));
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    async embedChatHistory(sessionId, chat) {
        try {
            if (!(chat === null || chat === void 0 ? void 0 : chat.messages))
                return;
            const memMsgs = chat.messages.map((m) => {
                var _a, _b;
                return ({
                    id: (_b = (_a = m._id) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '',
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                });
            });
            await this.memoryService.addChatMemory(sessionId, memMsgs);
            this.logger.debug(`📚 Embedded ${memMsgs.length} messages for session: ${sessionId}`);
        }
        catch (error) {
            this.logger.warn(`Failed to embed chat history: ${error}`);
        }
    }
};
exports.ChatWorker = ChatWorker;
exports.ChatWorker = ChatWorker = ChatWorker_1 = __decorate([
    (0, bullmq_1.Processor)('default'),
    __param(5, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [bedrock_service_1.BedrockService,
        chat_service_1.ChatService,
        agent_execution_service_1.AgentExecutionService,
        agent_orchestrator_service_1.AgentOrchestratorService,
        agent_service_1.AgentService,
        ioredis_1.Redis,
        memory_service_1.MemoryService])
], ChatWorker);
//# sourceMappingURL=chat.worker.js.map