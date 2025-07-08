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
var AgentOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./agent.service");
const agent_execution_service_1 = require("./agent-execution.service");
const tool_service_1 = require("./tool.service");
const bedrock_service_1 = require("../../infrastructure/bedrock/bedrock.service");
const memory_service_1 = require("../../services/memory.service");
const agent_execution_schema_1 = require("./agent-execution.schema");
let AgentOrchestratorService = AgentOrchestratorService_1 = class AgentOrchestratorService {
    constructor(agentService, agentExecutionService, toolService, bedrockService, memoryService) {
        this.agentService = agentService;
        this.agentExecutionService = agentExecutionService;
        this.toolService = toolService;
        this.bedrockService = bedrockService;
        this.memoryService = memoryService;
        this.logger = new common_1.Logger(AgentOrchestratorService_1.name);
    }
    async executeAgent(request) {
        const { agentId, sessionId, userId, message, context = [] } = request;
        this.logger.log(`🤖 Starting agent execution for agent: ${agentId}, session: ${sessionId}`);
        const execution = await this.agentExecutionService.createExecution(agentId, sessionId);
        try {
            const agent = await this.agentService.findOne(agentId);
            if (!agent) {
                throw new Error(`Agent with ID ${agentId} not found`);
            }
            await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.THINKING);
            const availableTools = this.getAvailableToolsForAgent(agent);
            const conversationHistory = await this.buildConversationContext(sessionId, context, message);
            const memoryContext = await this.getMemoryContext(sessionId, message);
            const systemPrompt = this.buildSystemPrompt(agent, availableTools, memoryContext);
            const toolsUsed = [];
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            let finalResponse = '';
            let reasoning = true;
            let iterationCount = 0;
            const maxIterations = 10;
            while (reasoning && iterationCount < maxIterations) {
                iterationCount++;
                this.logger.debug(`🔄 Agent reasoning iteration ${iterationCount}`);
                await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.THINKING, { progress: (iterationCount / maxIterations) * 50 });
                const llmResponse = await this.callLLMWithToolSupport(systemPrompt, conversationHistory, availableTools);
                totalInputTokens += llmResponse.inputTokens || 0;
                totalOutputTokens += llmResponse.outputTokens || 0;
                if (llmResponse.toolCall) {
                    const { toolName, toolParams } = llmResponse.toolCall;
                    await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.USING_TOOL, { currentTool: toolName, progress: 60 });
                    this.logger.debug(`🔧 Agent using tool: ${toolName}`);
                    const toolResult = await this.toolService.executeTool(toolName, toolParams);
                    toolsUsed.push(toolName);
                    conversationHistory.push({
                        role: 'assistant',
                        content: `Using tool ${toolName} with params: ${JSON.stringify(toolParams)}`
                    });
                    conversationHistory.push({
                        role: 'system',
                        content: `Tool result: ${JSON.stringify(toolResult)}`
                    });
                    continue;
                }
                finalResponse = llmResponse.content;
                reasoning = false;
            }
            await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.RESPONDING, { progress: 90 });
            await this.agentExecutionService.finish(execution.id, {
                input: totalInputTokens,
                output: totalOutputTokens
            });
            this.logger.log(`✅ Agent execution completed for session: ${sessionId}`);
            return {
                executionId: execution.id,
                response: finalResponse,
                toolsUsed,
                tokenUsage: {
                    input: totalInputTokens,
                    output: totalOutputTokens
                },
                status: agent_execution_schema_1.AgentExecutionStatus.RESPONDING
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`❌ Agent execution failed:`, errorMessage);
            await this.agentExecutionService.updateStatus(execution.id, agent_execution_schema_1.AgentExecutionStatus.ERROR);
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
            timestamp: new Date()
        });
        return history.slice(-10);
    }
    async getMemoryContext(sessionId, query) {
        var _a;
        try {
            const memoryResults = await this.memoryService.searchChatMemory(sessionId, query, 5);
            const documents = ((_a = memoryResults === null || memoryResults === void 0 ? void 0 : memoryResults.documents) === null || _a === void 0 ? void 0 : _a[0]) || [];
            if (documents.length > 0) {
                return `\n\nRelevant past context:\n${documents.map(doc => `- ${doc}`).join('\n')}`;
            }
            return '';
        }
        catch (error) {
            this.logger.warn(`Failed to get memory context: ${error}`);
            return '';
        }
    }
    buildSystemPrompt(agent, tools, memoryContext) {
        let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';
        if (tools.length > 0) {
            prompt += '\n\nYou have access to the following tools:\n';
            tools.forEach(tool => {
                prompt += `- ${tool.name}: ${tool.description}\n`;
            });
            prompt += '\nTo use a tool, respond with JSON in this format: {"tool": "tool_name", "params": {...}}';
            prompt += '\nIf you don\'t need to use any tools, respond normally.';
        }
        if (memoryContext) {
            prompt += memoryContext;
        }
        return prompt;
    }
    async callLLMWithToolSupport(systemPrompt, messages, availableTools) {
        try {
            const bedrockMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            const response = await this.callBedrockForResponse(systemPrompt, bedrockMessages);
            const toolCall = this.parseToolCall(response.content);
            return {
                content: response.content,
                toolCall,
                inputTokens: response.inputTokens,
                outputTokens: response.outputTokens
            };
        }
        catch (error) {
            this.logger.error(`LLM call failed: ${error}`);
            throw error;
        }
    }
    async callBedrockForResponse(systemPrompt, messages) {
        return {
            content: "I understand your request. Let me help you with that.",
            inputTokens: 100,
            outputTokens: 50
        };
    }
    parseToolCall(content) {
        try {
            const jsonMatch = content.match(/\{[^{}]*"tool"[^{}]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.tool && parsed.params) {
                    return {
                        toolName: parsed.tool,
                        toolParams: parsed.params
                    };
                }
            }
            return undefined;
        }
        catch (error) {
            return undefined;
        }
    }
    async getAgentExecutionStatus(executionId) {
        return this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.IDLE);
    }
    async cancelAgentExecution(executionId) {
        return this.agentExecutionService.updateStatus(executionId, agent_execution_schema_1.AgentExecutionStatus.ERROR);
    }
    async getExecutionHistory(sessionId) {
        return this.agentExecutionService.findBySession(sessionId);
    }
};
exports.AgentOrchestratorService = AgentOrchestratorService;
exports.AgentOrchestratorService = AgentOrchestratorService = AgentOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agent_service_1.AgentService,
        agent_execution_service_1.AgentExecutionService,
        tool_service_1.ToolService,
        bedrock_service_1.BedrockService,
        memory_service_1.MemoryService])
], AgentOrchestratorService);
//# sourceMappingURL=agent-orchestrator.service.js.map