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
var StreamingAgentOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingAgentOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const agent_execution_service_1 = require("./agent-execution.service");
const tool_service_1 = require("./tool.service");
const bedrock_service_1 = require("../../infrastructure/bedrock/bedrock.service");
const memory_service_1 = require("../../services/memory.service");
const streaming_service_1 = require("../../services/streaming.service");
const agent_execution_schema_1 = require("./agent-execution.schema");
let StreamingAgentOrchestratorService = StreamingAgentOrchestratorService_1 = class StreamingAgentOrchestratorService {
    constructor(agentService, agentExecutionService, toolService, bedrockService, memoryService, streamingService) {
        this.agentService = agentService;
        this.agentExecutionService = agentExecutionService;
        this.toolService = toolService;
        this.bedrockService = bedrockService;
        this.memoryService = memoryService;
        this.streamingService = streamingService;
        this.logger = new common_1.Logger(StreamingAgentOrchestratorService_1.name);
    }
    async executeAgentStreaming(request) {
        const { agentId, sessionId, userId, message, context = [], streamingOptions = {} } = request;
        this.logger.log(`🚀 Starting streaming agent execution for agent: ${agentId}, session: ${sessionId}`);
        const execution = await this.agentExecutionService.createExecution(agentId, sessionId);
        try {
            this.streamingService.startStream(sessionId, execution.id, agentId, userId, message);
            const agent = await this.agentService.findOne(agentId);
            if (!agent) {
                throw new Error(`Agent with ID ${agentId} not found`);
            }
            await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.THINKING);
            this.executeStreamingLoop(execution.id, sessionId, agent, message, context, streamingOptions)
                .catch(error => {
                this.logger.error(`❌ Streaming execution failed:`, error.message);
                this.streamingService.emitError(sessionId, error.message, 'EXECUTION_ERROR');
            });
            return {
                executionId: execution.id,
                sessionId,
                status: 'streaming',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Failed to start streaming execution:`, errorMessage);
            await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.ERROR);
            this.streamingService.emitError(sessionId, errorMessage, 'STARTUP_ERROR');
            return {
                executionId: execution.id,
                sessionId,
                status: 'error',
            };
        }
    }
    async executeStreamingLoop(executionId, sessionId, agent, message, context, streamingOptions) {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const toolsUsed = [];
        try {
            const availableTools = this.getAvailableToolsForAgent(agent);
            const conversationHistory = await this.buildConversationContext(sessionId, context, message);
            const memoryContext = await this.getMemoryContext(sessionId, message);
            const systemPrompt = this.buildSystemPrompt(agent, availableTools, memoryContext);
            let reasoning = true;
            let iterationCount = 0;
            const maxIterations = 10;
            while (reasoning && iterationCount < maxIterations) {
                iterationCount++;
                this.logger.debug(`🔄 Streaming agent reasoning iteration ${iterationCount}`);
                await this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.THINKING, { progress: (iterationCount / maxIterations) * 50 });
                const streamResult = await this.callLLMWithStreaming(systemPrompt, conversationHistory, availableTools, sessionId, streamingOptions);
                totalInputTokens += streamResult.inputTokens || 0;
                totalOutputTokens += streamResult.outputTokens || 0;
                if (streamResult.toolCall) {
                    const { toolName, toolParams, reasoning: toolReasoning } = streamResult.toolCall;
                    this.streamingService.emitToolCall(sessionId, toolName, toolParams, toolReasoning);
                    await this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.USING_TOOL, { currentTool: toolName, progress: 60 });
                    this.logger.debug(`🔧 Agent using tool: ${toolName}`);
                    try {
                        const toolResult = await this.toolService.executeTool(toolName, toolParams);
                        toolsUsed.push(toolName);
                        this.streamingService.emitToolResult(sessionId, toolName, toolResult, true);
                        conversationHistory.push({
                            role: 'assistant',
                            content: `Using tool ${toolName} with params: ${JSON.stringify(toolParams)}`
                        });
                        conversationHistory.push({
                            role: 'system',
                            content: `Tool result: ${JSON.stringify(toolResult)}`
                        });
                    }
                    catch (toolError) {
                        const errorMsg = toolError instanceof Error ? toolError.message : 'Tool execution failed';
                        this.streamingService.emitToolResult(sessionId, toolName, null, false, errorMsg);
                        conversationHistory.push({
                            role: 'system',
                            content: `Tool execution failed: ${errorMsg}`
                        });
                    }
                    continue;
                }
                reasoning = false;
            }
            await this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.RESPONDING, { progress: 90 });
            this.streamingService.completeStream(sessionId);
            await this.agentExecutionService.finish(executionId, {
                input: totalInputTokens,
                output: totalOutputTokens
            });
            this.logger.log(`✅ Streaming agent execution completed for session: ${sessionId}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Streaming execution loop failed:`, errorMessage);
            await this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.ERROR);
            this.streamingService.emitError(sessionId, errorMessage, 'EXECUTION_ERROR');
        }
    }
    async callLLMWithStreaming(systemPrompt, messages, availableTools, sessionId, streamingOptions) {
        var _a;
        try {
            const bedrockMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
            const stream = await this.bedrockService.converseStream({
                modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
                messages: bedrockMessages,
                systemPrompt,
                toolConfig: availableTools.length > 0 ? { tools: availableTools } : undefined,
                temperature: 0.7,
                maxTokens: 4000,
            });
            let finalContent = '';
            let toolCall = undefined;
            let inputTokens = 0;
            let outputTokens = 0;
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    const textChunk = ((_a = chunk.delta) === null || _a === void 0 ? void 0 : _a.text) || '';
                    if (textChunk) {
                        finalContent += textChunk;
                        this.streamingService.emitChunk(sessionId, textChunk);
                        if (streamingOptions.chunkDelay && streamingOptions.chunkDelay > 0) {
                            await new Promise(resolve => setTimeout(resolve, streamingOptions.chunkDelay));
                        }
                    }
                }
                else if (chunk.type === 'tool_use') {
                    toolCall = {
                        toolName: chunk.name,
                        toolParams: chunk.input,
                        reasoning: finalContent.trim(),
                    };
                }
                else if (chunk.type === 'token_usage') {
                    inputTokens = chunk.input_tokens || 0;
                    outputTokens = chunk.output_tokens || 0;
                }
            }
            return {
                finalContent,
                toolCall,
                inputTokens,
                outputTokens,
            };
        }
        catch (error) {
            this.logger.error(`Error in streaming LLM call:`, error);
            throw error;
        }
    }
    getAvailableToolsForAgent(agent) {
        const allTools = this.toolService.getAllTools();
        return allTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
    }
    async buildConversationContext(sessionId, context, newMessage) {
        const history = [...context];
        history.push({
            role: 'user',
            content: newMessage,
            timestamp: new Date(),
        });
        return history;
    }
    async getMemoryContext(sessionId, query) {
        try {
            const memories = await this.memoryService.searchChatMemory(sessionId, query, 5);
            if (memories && memories.documents && memories.documents[0]) {
                return `Relevant context from previous conversations:\n${memories.documents[0].join('\n')}`;
            }
            return '';
        }
        catch (error) {
            this.logger.warn(`Failed to retrieve memory context: ${error}`);
            return '';
        }
    }
    buildSystemPrompt(agent, tools, memoryContext) {
        let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';
        if (memoryContext) {
            prompt += `\n\nContext:\n${memoryContext}`;
        }
        if (tools.length > 0) {
            prompt += `\n\nYou have access to the following tools:\n${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
        }
        return prompt;
    }
    async cancelStreamingExecution(sessionId) {
        this.streamingService.cancelStream(sessionId);
        this.logger.log(`🛑 Streaming execution cancelled for session: ${sessionId}`);
    }
    async getStreamingStatus(sessionId) {
        const session = this.streamingService.getSession(sessionId);
        return {
            isActive: this.streamingService.isSessionActive(sessionId),
            session: session ? {
                executionId: session.executionId,
                agentId: session.agentId,
                userId: session.userId,
                startTime: session.startTime,
                accumulatedResponse: session.accumulatedResponse,
                toolsUsed: session.toolsUsed,
                tokenUsage: session.tokenUsage,
            } : null,
        };
    }
};
exports.StreamingAgentOrchestratorService = StreamingAgentOrchestratorService;
exports.StreamingAgentOrchestratorService = StreamingAgentOrchestratorService = StreamingAgentOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_service_1.AgentService,
        agent_execution_service_1.AgentExecutionService,
        tool_service_1.ToolService,
        bedrock_service_1.BedrockService,
        memory_service_1.MemoryService,
        streaming_service_1.StreamingService])
], StreamingAgentOrchestratorService);
//# sourceMappingURL=streaming-agent-orchestrator.service.js.map