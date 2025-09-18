"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimplifiedModernAgent = void 0;
exports.createSimplifiedModernAgent = createSimplifiedModernAgent;
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
const aws_1 = require("@langchain/aws");
const langmemService_1 = require("../services/langmemService");
const promptTemplateManager_1 = require("./promptTemplateManager");
const intentRouter_1 = require("./intentRouter");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
class SimplifiedModernAgent {
    constructor(config) {
        this.tools = [];
        this.toolsInitialized = false;
        this.config = config;
        this.llm = new aws_1.ChatBedrockConverse({
            model: config.modelId,
            region: process.env.AWS_REGION || 'us-east-1',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            streaming: true
        });
        console.log(`🤖 Simplified Modern Agent initialized for session ${config.sessionId}`);
    }
    async setupTools() {
        if (this.toolsInitialized) {
            console.log('🔧 Tools already initialized, skipping...');
            return;
        }
        console.log('🔧 Setting up tools with UnifiedToolRegistry (optimized)...');
        const startTime = Date.now();
        const cacheKey = this.createToolCacheKey();
        const cachedTools = SimplifiedModernAgent.toolCache.get(cacheKey);
        if (cachedTools) {
            console.log('⚡ Using cached tools for better performance');
            this.tools = [...cachedTools];
            this.toolsInitialized = true;
            console.log(`✅ ${this.tools.length} tools loaded from cache in ${Date.now() - startTime}ms`);
            return;
        }
        const toolContext = {
            sessionId: this.config.sessionId,
            userId: this.config.userId,
            agentId: this.config.agentId,
            collectionNames: this.config.collectionNames,
            config: this.config
        };
        const [sessionTools, memoryTools, collectionTools, availableTools] = await Promise.all([
            Promise.resolve(unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(this.config.sessionId)),
            this.createMemoryToolsOptimized(),
            Promise.resolve(this.config.collectionNames && this.config.collectionNames.length > 0
                ? unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(this.config.collectionNames)
                : []),
            Promise.resolve(unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(toolContext))
        ]);
        const allTools = [...sessionTools, ...memoryTools, ...collectionTools, ...availableTools];
        this.tools = allTools.map(toolConfig => this.createDynamicTool(toolConfig, toolContext));
        if (this.config.collectionNames && this.config.collectionNames.length > 0) {
            const staticTools = [...collectionTools, ...availableTools].map(toolConfig => this.createDynamicTool(toolConfig, toolContext));
            SimplifiedModernAgent.toolCache.set(cacheKey, staticTools);
        }
        this.toolsInitialized = true;
        console.log(`✅ ${this.tools.length} tools configured in ${Date.now() - startTime}ms`);
        console.log(`🔧 Tools: ${this.tools.map(t => t.name).join(', ')}`);
    }
    createToolCacheKey() {
        return `${this.config.collectionNames?.join(',') || 'no-collections'}_${this.config.agentId || 'default'}`;
    }
    async createMemoryToolsOptimized() {
        try {
            const hasMemory = await langmemService_1.langmemService.hasMemoryForSession(this.config.sessionId);
            if (hasMemory) {
                return await unifiedToolRegistry_1.unifiedToolRegistry.createMemorySearchToolsIfNeeded(this.config.sessionId);
            }
            return [];
        }
        catch (error) {
            console.warn('⚠️ Memory check failed, skipping memory tools:', error);
            return [];
        }
    }
    createDynamicTool(toolConfig, toolContext) {
        return new tools_1.DynamicTool({
            name: toolConfig.name.toLowerCase().replace(/\s+/g, '_'),
            description: toolConfig.description,
            func: async (input) => {
                const result = await unifiedToolRegistry_1.unifiedToolRegistry.executeTool(toolConfig.id, input, toolContext);
                return result.success ? result.result : `Error: ${result.error}`;
            }
        });
    }
    async run(messages, onEvent) {
        console.log(`🚀 Simplified Modern Agent running with ${messages.length} messages`);
        try {
            await this.setupTools();
            await this.retrieveMemoryContext(messages);
            let iteration = 0;
            const maxIterations = this.config.maxIterations || 5;
            while (iteration < maxIterations) {
                iteration++;
                console.log(`🔄 Iteration ${iteration}/${maxIterations}`);
                const systemPrompt = await this.buildSystemPrompt();
                const fullMessages = [new messages_1.SystemMessage(systemPrompt), ...messages];
                const { response, hasToolCalls, toolCalls } = await this.streamLLMResponse(fullMessages, onEvent);
                if (!hasToolCalls) {
                    await this.updateMemory(messages, response);
                    if (onEvent) {
                        onEvent({
                            type: 'end',
                            data: {
                                answer: response,
                                inputTokens: 0,
                                outputTokens: 0,
                                iterations: iteration
                            }
                        });
                    }
                    console.log(`✅ Completed in ${iteration} iterations`);
                    return response;
                }
                const toolResults = await this.executeTools(toolCalls, onEvent);
                messages.push(new messages_1.AIMessage(response));
                messages.push(new messages_1.HumanMessage(`Tool results: ${JSON.stringify(toolResults)}`));
            }
            const finalResponse = 'I need more iterations to complete this task properly.';
            if (onEvent) {
                onEvent({
                    type: 'end',
                    data: {
                        answer: finalResponse,
                        inputTokens: 0,
                        outputTokens: 0,
                        iterations: iteration
                    }
                });
            }
            return finalResponse;
        }
        catch (error) {
            console.error('❌ Simplified Modern Agent execution failed:', error);
            if (onEvent) {
                onEvent({
                    type: 'error',
                    data: { error: error.message }
                });
            }
            throw error;
        }
    }
    async retrieveMemoryContext(messages) {
        console.log('🧠 Retrieving memory context (optimized)...');
        const startTime = Date.now();
        try {
            const lastUserMessage = messages
                .filter(msg => msg instanceof messages_1.HumanMessage)
                .pop();
            if (!lastUserMessage) {
                this.memoryContext = null;
                return;
            }
            const hasMemory = await langmemService_1.langmemService.hasMemoryForSession(this.config.sessionId);
            if (!hasMemory) {
                console.log('📭 No memory found for session, skipping memory retrieval');
                this.memoryContext = null;
                return;
            }
            const context = {
                sessionId: this.config.sessionId,
                userId: this.config.userId,
                agentId: this.config.agentId,
                namespace: 'conversation'
            };
            const [relevantMemories, recentMessages] = await Promise.all([
                langmemService_1.langmemService.searchMemories(lastUserMessage.content, context, { limit: 5 }).catch(error => {
                    console.warn('⚠️ Relevant memory search failed:', error);
                    return [];
                }),
                langmemService_1.langmemService.getContextualMemories(context, { limit: 10 }).catch(error => {
                    console.warn('⚠️ Recent memory retrieval failed:', error);
                    return [];
                })
            ]);
            this.memoryContext = {
                relevantMemories,
                recentMessages
            };
            console.log(`📚 Memory context retrieved in ${Date.now() - startTime}ms: ${relevantMemories.length} relevant, ${recentMessages.length} recent`);
        }
        catch (error) {
            console.warn('⚠️ Failed to retrieve memory context:', error);
            this.memoryContext = null;
        }
    }
    async buildSystemPrompt() {
        let systemPrompt;
        if (this.config.useTemplateSystem && this.config.intent) {
            try {
                console.log('🎯 Building prompt using template system (Simplified)...');
                const templateContext = {
                    intent: this.config.intent,
                    agentType: intentRouter_1.AgentType.SIMPLIFIED_MODERN,
                    complexity: this.config.workflowComplexity || intentRouter_1.WorkflowComplexity.SIMPLE,
                    tools: this.tools.map(tool => tool.name),
                    memoryContext: this.memoryContext,
                    maxIterations: this.config.maxIterations,
                    sessionData: { sessionId: this.config.sessionId },
                    ...this.config.templateContext
                };
                const renderedTemplate = await promptTemplateManager_1.promptTemplateManager.renderForIntentAndAgent(this.config.intent, intentRouter_1.AgentType.SIMPLIFIED_MODERN, templateContext);
                systemPrompt = renderedTemplate.content;
                console.log(`✅ Using template: ${renderedTemplate.metadata.name} (${renderedTemplate.version})`);
            }
            catch (error) {
                console.warn('⚠️ Template system failed, falling back to legacy prompt:', error);
                systemPrompt = this.config.systemPrompt || this.buildLegacyPrompt();
            }
        }
        else {
            systemPrompt = this.config.systemPrompt || this.buildLegacyPrompt();
        }
        if (!this.config.useTemplateSystem || !this.config.intent) {
            systemPrompt += this.buildThinkingFormatInstructions();
        }
        if (this.memoryContext) {
            systemPrompt += this.buildMemoryContextInstructions();
        }
        if (this.tools.length > 0) {
            systemPrompt += this.buildToolInstructions();
        }
        return systemPrompt;
    }
    buildLegacyPrompt() {
        return "You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
    }
    buildThinkingFormatInstructions() {
        return `\n\n## Response Format:
When responding to user queries, structure your response using this format:

<thinking>
Your reasoning process here:
- Analyze the user's question
- Determine if tools are needed and which ones
- Plan your approach to answering
- Consider any relevant context or constraints
</thinking>

Your final answer here (clear, direct response to the user's question).

## Guidelines:
- Always include <thinking> tags for your reasoning process
- Keep thinking concise but comprehensive
- Only show tool usage reasoning in thinking, not in final answer
- Make your final answer clean and user-focused`;
    }
    buildMemoryContextInstructions() {
        let instructions = '';
        if (this.memoryContext.relevantMemories.length > 0) {
            instructions += `\n\nRelevant memories: ${JSON.stringify(this.memoryContext.relevantMemories)}`;
        }
        if (this.memoryContext.recentMessages.length > 0) {
            instructions += `\n\nRecent context: ${JSON.stringify(this.memoryContext.recentMessages)}`;
        }
        return instructions;
    }
    buildToolInstructions() {
        const toolDescriptions = this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n');
        return `\n\n## Available Tools:\n${toolDescriptions}

## Tool Selection Guidelines:
- Only use knowledge base tools (search_*) for domain-specific questions that require specialized information
- Use web_search for current events, recent information, or when knowledge base doesn't have relevant data
- Use calculator only for mathematical calculations or numerical computations
- Use current_date only when user asks for current time/date information
- Use search_conversation_memory only to recall previous conversation context
- THINK in <thinking> tags before selecting tools
- If the question can be answered with general knowledge, DO NOT use any tools

To use a tool, mention it clearly in your thinking: "I need to use [tool_name]" or "Let me [tool_name]".`;
    }
    async streamLLMResponse(messages, onEvent) {
        let fullResponse = '';
        try {
            const stream = await this.llm.stream(messages);
            for await (const chunk of stream) {
                const content = chunk.content?.toString() || '';
                if (content) {
                    fullResponse += content;
                    if (onEvent) {
                        onEvent({
                            type: 'chunk',
                            data: { delta: content }
                        });
                    }
                }
            }
            const toolCalls = this.extractToolCalls(fullResponse);
            const hasToolCalls = toolCalls.length > 0;
            return {
                response: fullResponse,
                hasToolCalls,
                toolCalls
            };
        }
        catch (error) {
            console.error('❌ LLM streaming failed:', error);
            throw error;
        }
    }
    extractToolCalls(response) {
        const calls = [];
        for (const tool of this.tools) {
            const patterns = [
                new RegExp(`use ${tool.name}`, 'i'),
                new RegExp(`search.*${tool.name.split('_')[1]}`, 'i'),
                new RegExp(`need to ${tool.name}`, 'i')
            ];
            for (const pattern of patterns) {
                if (pattern.test(response)) {
                    const lines = response.split('\n');
                    const relevantLine = lines.find(line => pattern.test(line));
                    const query = relevantLine || response.split('.')[0] || response.substring(0, 100);
                    calls.push({
                        name: tool.name,
                        input: query.replace(/['"]/g, '').trim()
                    });
                    break;
                }
            }
        }
        return calls;
    }
    async executeTools(toolCalls, onEvent) {
        const results = {};
        for (const toolCall of toolCalls) {
            console.log(`🔧 Executing tool: ${toolCall.name}`);
            if (onEvent) {
                onEvent({
                    type: 'tool_start',
                    data: {
                        tool_name: toolCall.name,
                        tool_input: toolCall.input
                    }
                });
            }
            try {
                const tool = this.tools.find(t => t.name === toolCall.name);
                if (!tool) {
                    throw new Error(`Tool ${toolCall.name} not found`);
                }
                const result = await tool.func(toolCall.input);
                results[toolCall.name] = result;
                if (onEvent) {
                    onEvent({
                        type: 'tool_result',
                        data: {
                            tool_name: toolCall.name,
                            output: result
                        }
                    });
                }
                console.log(`✅ Tool ${toolCall.name} executed successfully`);
            }
            catch (error) {
                const errorMessage = `Tool ${toolCall.name} failed: ${error.message}`;
                results[toolCall.name] = errorMessage;
                if (onEvent) {
                    onEvent({
                        type: 'tool_result',
                        data: {
                            tool_name: toolCall.name,
                            output: errorMessage
                        }
                    });
                }
                console.error(`❌ Tool ${toolCall.name} failed:`, error);
            }
        }
        return results;
    }
    async updateMemory(messages, response) {
        console.log('💾 Updating memory...');
        try {
            const context = {
                sessionId: this.config.sessionId,
                userId: this.config.userId,
                agentId: this.config.agentId,
                namespace: 'conversation'
            };
            const recentMessages = messages.slice(-2).map(msg => ({
                role: msg instanceof messages_1.HumanMessage ? 'user' : 'assistant',
                content: msg.content,
                timestamp: new Date().toISOString()
            }));
            recentMessages.push({
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            });
            if (recentMessages.length > 0) {
                await langmemService_1.langmemService.processMessages(recentMessages, context);
                console.log(`💾 Processed ${recentMessages.length} messages for memory`);
            }
        }
        catch (error) {
            console.error('❌ Memory update failed:', error);
        }
    }
    getState() {
        return {
            sessionId: this.config.sessionId,
            toolCount: this.tools.length,
            modelId: this.config.modelId,
            hasMemoryContext: !!this.memoryContext
        };
    }
    visualize() {
        return `Simplified Modern Agent:
- Model: ${this.config.modelId}
- Session: ${this.config.sessionId}
- Tools: ${this.tools.length}
- Collections: ${this.config.collectionNames?.length || 0}
- Max Iterations: ${this.config.maxIterations || 5}`;
    }
}
exports.SimplifiedModernAgent = SimplifiedModernAgent;
SimplifiedModernAgent.toolCache = new Map();
async function createSimplifiedModernAgent(config) {
    console.log('🏭 Creating Simplified Modern Agent...');
    const agent = new SimplifiedModernAgent(config);
    return {
        run: agent.run.bind(agent),
        getState: agent.getState.bind(agent),
        visualize: agent.visualize.bind(agent)
    };
}
//# sourceMappingURL=simplifiedModernAgent.js.map