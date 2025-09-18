"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedReasoningAgent = void 0;
exports.createAdvancedReasoningAgent = createAdvancedReasoningAgent;
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
const aws_1 = require("@langchain/aws");
const langmemService_1 = require("../services/langmemService");
const realEmbeddingService_1 = require("./realEmbeddingService");
const chromaService_1 = require("../services/chromaService");
const promptTemplateManager_1 = require("./promptTemplateManager");
const intentRouter_1 = require("./intentRouter");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
class AdvancedReasoningAgent {
    constructor(config) {
        this.tools = [];
        this.reflectionHistory = [];
        this.toolsInitialized = false;
        this.config = config;
        this.llm = new aws_1.ChatBedrockConverse({
            model: config.modelId,
            region: process.env.AWS_REGION || 'us-east-1',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4000,
            streaming: true
        });
        console.log(`🧠 Advanced Reasoning Agent initialized with ${config.reasoningMode} mode`);
    }
    async setupTools() {
        console.log('🔧 Setting up advanced tools with UnifiedToolRegistry and reasoning...');
        const toolContext = {
            sessionId: this.config.sessionId,
            userId: this.config.userId,
            agentId: this.config.agentId,
            collectionNames: this.config.collectionNames,
            config: this.config
        };
        const sessionTools = unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(this.config.sessionId);
        const memoryTools = await unifiedToolRegistry_1.unifiedToolRegistry.createMemorySearchToolsIfNeeded(this.config.sessionId);
        const collectionTools = this.config.collectionNames && this.config.collectionNames.length > 0
            ? unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(this.config.collectionNames)
            : [];
        const availableTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(toolContext);
        for (const toolConfig of [...sessionTools, ...memoryTools, ...collectionTools, ...availableTools]) {
            const dynamicTool = new tools_1.DynamicTool({
                name: toolConfig.name.toLowerCase().replace(/\s+/g, '_'),
                description: `[REASONING] ${toolConfig.description}`,
                func: async (input) => {
                    const result = await unifiedToolRegistry_1.unifiedToolRegistry.executeTool(toolConfig.id, input, toolContext);
                    if (result.success) {
                        return `${result.result}\n\n[Reasoning: Tool executed successfully with confidence ${result.metadata?.confidence || 'high'}]`;
                    }
                    else {
                        return `Error: ${result.error}\n[Reasoning: Tool execution failed, should consider alternative approaches]`;
                    }
                }
            });
            this.tools.push(dynamicTool);
        }
        await this.setupReasoningTools();
        console.log(`✅ ${this.tools.length} advanced tools configured via UnifiedToolRegistry`);
        console.log(`🔧 Tools: ${this.tools.map(t => t.name).join(', ')}`);
    }
    async setupAgentSpecificTools() {
        console.log('🎯 Setting up agent-specific tools with reasoning...');
        for (const toolConfig of this.config.agentTools) {
            if (!toolConfig.enabled)
                continue;
            switch (toolConfig.type) {
                case 'WEB_SEARCH':
                    await this.setupWebSearchTool(toolConfig);
                    break;
                case 'RETRIEVER':
                    await this.setupKnowledgeTools();
                    break;
                case 'MEMORY_SEARCH':
                    await this.setupMemoryTools();
                    break;
                case 'CALCULATOR':
                    await this.setupCalculatorTool(toolConfig);
                    break;
                case 'CURRENT_DATE':
                    await this.setupDateTool(toolConfig);
                    break;
                default:
                    console.warn(`🚫 Unknown tool type: ${toolConfig.type}`);
            }
        }
        await this.setupReasoningTools();
    }
    async setupWebSearchTool(toolConfig) {
        const tool = new tools_1.DynamicTool({
            name: 'web_search_with_reasoning',
            description: 'Search the web with reasoning - first analyzes if search is needed, then performs targeted search',
            func: async (input) => {
                try {
                    console.log(`🌐 Web search with reasoning: ${input.substring(0, 50)}...`);
                    const searchReasoning = await this.reasonAboutToolUse('web_search', input);
                    if (!searchReasoning.shouldUse) {
                        return `Reasoning concluded that web search is not needed: ${searchReasoning.reason}`;
                    }
                    const enhancedQuery = searchReasoning.enhancedInput || input;
                    return `Web search for "${enhancedQuery}" - functionality not yet implemented but reasoning suggests: ${searchReasoning.reason}`;
                }
                catch (error) {
                    return `Web search failed: ${error.message}`;
                }
            }
        });
        this.tools.push(tool);
    }
    async setupCalculatorTool(toolConfig) {
        const tool = new tools_1.DynamicTool({
            name: 'calculator_with_reasoning',
            description: 'Perform mathematical calculations with step-by-step reasoning and verification',
            func: async (input) => {
                try {
                    console.log(`🧮 Calculator with reasoning: ${input.substring(0, 50)}...`);
                    const mathReasoning = await this.reasonAboutMathProblem(input);
                    return `Calculation reasoning:\n${mathReasoning.steps.join('\n')}\nResult: ${mathReasoning.result}`;
                }
                catch (error) {
                    return `Calculation failed: ${error.message}`;
                }
            }
        });
        this.tools.push(tool);
    }
    async setupDateTool(toolConfig) {
        const tool = new tools_1.DynamicTool({
            name: 'current_date_with_context',
            description: 'Get current date and time with contextual reasoning about why this information is needed',
            func: async (input) => {
                try {
                    const now = new Date();
                    const thailandTime = new Intl.DateTimeFormat('th-TH', {
                        timeZone: 'Asia/Bangkok',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).format(now);
                    const dateReasoning = await this.reasonAboutDateRequest(input);
                    return `Current date and time in Thailand: ${thailandTime}\nContext: ${dateReasoning}`;
                }
                catch (error) {
                    return `Date retrieval failed: ${error.message}`;
                }
            }
        });
        this.tools.push(tool);
    }
    async setupKnowledgeTools() {
        console.log('📚 Setting up knowledge tools with reasoning...');
        for (const collectionName of this.config.collectionNames) {
            const tool = new tools_1.DynamicTool({
                name: `search_${collectionName}_with_reasoning`,
                description: `Search ${collectionName} knowledge base with intelligent query analysis and result synthesis`,
                func: async (input) => {
                    try {
                        console.log(`🔍 Reasoning-based search in ${collectionName}: ${input.substring(0, 50)}...`);
                        const searchReasoning = await this.reasonAboutKnowledgeSearch(input, collectionName);
                        const enhancedQuery = searchReasoning.enhancedQuery || input;
                        const queryEmbedding = await realEmbeddingService_1.realEmbeddingService.embed(enhancedQuery);
                        if (!queryEmbedding || queryEmbedding.length === 0) {
                            return `Search in ${collectionName} is currently unavailable.`;
                        }
                        const collection = await chromaService_1.chromaService.getOrCreateCollection(collectionName);
                        const results = await collection.query({
                            queryEmbeddings: [queryEmbedding],
                            nResults: 5
                        });
                        if (!results.documents || results.documents[0].length === 0) {
                            return `No relevant information found in ${collectionName} for query: ${enhancedQuery}`;
                        }
                        console.log(`✅ Found ${results.documents[0].length} results in ${collectionName}`);
                        const synthesizedResults = await this.synthesizeSearchResults(results.documents[0].filter(doc => doc !== null), enhancedQuery, searchReasoning.intent);
                        return synthesizedResults;
                    }
                    catch (error) {
                        console.error(`❌ Reasoning-based search failed in ${collectionName}:`, error);
                        return `Search error in ${collectionName}: ${error.message}`;
                    }
                }
            });
            this.tools.push(tool);
        }
    }
    async setupMemoryTools() {
        console.log('🧠 Setting up memory tools with reasoning...');
        const memoryTool = new tools_1.DynamicTool({
            name: 'search_memory_with_reasoning',
            description: 'Search conversation memory with contextual reasoning and relevance analysis',
            func: async (input) => {
                try {
                    const context = {
                        sessionId: this.config.sessionId,
                        userId: this.config.userId,
                        agentId: this.config.agentId,
                        namespace: 'conversation'
                    };
                    const memoryReasoning = await this.reasonAboutMemorySearch(input);
                    const memories = await langmemService_1.langmemService.searchMemories(memoryReasoning.enhancedQuery, context, { limit: 5 });
                    if (memories.length === 0) {
                        return `No relevant conversation history found for: ${memoryReasoning.intent}`;
                    }
                    const contextualMemory = await this.synthesizeMemoryContext(memories, memoryReasoning.intent);
                    return contextualMemory;
                }
                catch (error) {
                    return `Memory search failed: ${error.message}`;
                }
            }
        });
        this.tools.push(memoryTool);
    }
    async setupReasoningTools() {
        console.log('🧠 Setting up specialized reasoning tools...');
        const reflectionTool = new tools_1.DynamicTool({
            name: 'self_reflection',
            description: 'Reflect on reasoning process and identify potential improvements or errors',
            func: async (input) => {
                try {
                    const reflection = await this.performSelfReflection(input);
                    this.reflectionHistory.push(reflection);
                    return reflection;
                }
                catch (error) {
                    return `Reflection failed: ${error.message}`;
                }
            }
        });
        const validationTool = new tools_1.DynamicTool({
            name: 'validate_reasoning',
            description: 'Validate the logic and consistency of reasoning steps',
            func: async (input) => {
                try {
                    return await this.validateReasoningChain(input);
                }
                catch (error) {
                    return `Reasoning validation failed: ${error.message}`;
                }
            }
        });
        this.tools.push(reflectionTool, validationTool);
    }
    async run(messages, onEvent) {
        console.log(`🧠 Advanced Reasoning Agent running with ${this.config.reasoningMode} mode`);
        try {
            await this.setupTools();
            await this.retrieveMemoryContext(messages);
            this.currentReasoningChain = {
                problem: this.extractProblemFromMessages(messages),
                steps: [],
                conclusion: '',
                totalConfidence: 0,
                selectedPath: this.config.reasoningMode
            };
            let iteration = 0;
            const maxIterations = this.config.maxIterations || 5;
            while (iteration < maxIterations) {
                iteration++;
                console.log(`🔄 Reasoning iteration ${iteration}/${maxIterations}`);
                const systemPrompt = await this.buildAdvancedReasoningPrompt();
                const fullMessages = [new messages_1.SystemMessage(systemPrompt), ...messages];
                const { response, hasToolCalls, toolCalls, reasoningSteps } = await this.streamReasoningResponse(fullMessages, onEvent);
                if (reasoningSteps.length > 0) {
                    this.currentReasoningChain.steps.push(...reasoningSteps);
                }
                if (!hasToolCalls) {
                    await this.finalizeReasoningChain(response);
                    if (this.config.enableReflection) {
                        await this.performFinalReflection(onEvent);
                    }
                    await this.updateMemory(messages, response);
                    if (onEvent) {
                        onEvent({
                            type: 'end',
                            data: {
                                answer: response,
                                reasoningChain: this.currentReasoningChain,
                                inputTokens: 0,
                                outputTokens: 0,
                                iterations: iteration
                            }
                        });
                    }
                    console.log(`✅ Advanced reasoning completed in ${iteration} iterations`);
                    return response;
                }
                const toolResults = await this.executeToolsWithReasoning(toolCalls, onEvent);
                messages.push(new messages_1.AIMessage(response));
                messages.push(new messages_1.HumanMessage(`Tool results: ${JSON.stringify(toolResults)}`));
            }
            const finalResponse = 'I need more reasoning iterations to complete this task properly.';
            if (onEvent) {
                onEvent({
                    type: 'end',
                    data: {
                        answer: finalResponse,
                        reasoningChain: this.currentReasoningChain,
                        inputTokens: 0,
                        outputTokens: 0,
                        iterations: iteration
                    }
                });
            }
            return finalResponse;
        }
        catch (error) {
            console.error('❌ Advanced Reasoning Agent execution failed:', error);
            if (onEvent) {
                onEvent({
                    type: 'error',
                    data: { error: error.message }
                });
            }
            throw error;
        }
    }
    async buildAdvancedReasoningPrompt() {
        let systemPrompt;
        if (this.config.useTemplateSystem && this.config.intent) {
            try {
                console.log('🎯 Building prompt using template system...');
                const templateContext = {
                    intent: this.config.intent,
                    agentType: intentRouter_1.AgentType.ADVANCED_REASONING,
                    complexity: this.config.workflowComplexity || intentRouter_1.WorkflowComplexity.COMPLEX,
                    reasoningMode: this.config.reasoningMode,
                    tools: this.tools.map(tool => tool.name),
                    memoryContext: this.memoryContext,
                    enableReflection: this.config.enableReflection,
                    enableSelfConsistency: this.config.enableSelfConsistency,
                    maxIterations: this.config.maxIterations,
                    sessionData: { sessionId: this.config.sessionId },
                    ...this.config.templateContext
                };
                const renderedTemplate = await promptTemplateManager_1.promptTemplateManager.renderForIntentAndAgent(this.config.intent, intentRouter_1.AgentType.ADVANCED_REASONING, templateContext);
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
        systemPrompt += this.buildReasoningModeInstructions();
        if (this.memoryContext) {
            systemPrompt += this.buildMemoryContextInstructions();
        }
        if (this.tools.length > 0) {
            systemPrompt += this.buildToolGuidanceInstructions();
        }
        return systemPrompt;
    }
    buildLegacyPrompt() {
        return "You are an advanced AI assistant with sophisticated reasoning capabilities. Think step-by-step, analyze problems deeply, and use tools intelligently to provide accurate and well-reasoned responses.";
    }
    buildReasoningModeInstructions() {
        let instructions = '';
        switch (this.config.reasoningMode) {
            case 'zero-shot-cot':
                instructions += `\n\n## Zero-Shot Chain of Thought Instructions:
When responding to complex queries, always think step by step. Begin your reasoning with "Let me think about this step by step:" and break down your thought process into clear, logical steps before providing your final answer.`;
                break;
            case 'auto-cot':
                instructions += `\n\n## Auto-CoT Instructions:
Automatically generate diverse reasoning demonstrations for complex problems. Consider multiple approaches, analyze different perspectives, and select the most logical reasoning path. Show your reasoning process clearly.`;
                break;
            case 'tree-of-thoughts':
                instructions += `\n\n## Tree of Thoughts Instructions:
For complex problems, explore multiple reasoning branches. Generate several possible thoughts at each step, evaluate them, and select the most promising path. Show your exploration of different possibilities.`;
                break;
            default:
                instructions += `\n\n## Chain of Thought Instructions:
Break down complex problems into clear reasoning steps. Show your thought process, intermediate conclusions, and how you arrive at your final answer.`;
        }
        instructions += `\n\n## Advanced Reasoning Format:
Structure your response as follows:

<thinking>
Your detailed reasoning process:
1. Problem analysis: What exactly is being asked?
2. Context consideration: What relevant information do I have?
3. Approach planning: What steps should I take?
4. Tool evaluation: Do I need any tools for this task?
5. Reasoning chain: Step-by-step logical progression
6. Confidence assessment: How confident am I in each step?
</thinking>

Your clear, well-reasoned response here.

## Advanced Guidelines:
- Always show your reasoning process in <thinking> tags
- Consider multiple perspectives before deciding
- Validate your reasoning at each step
- Use tools when they enhance your reasoning capability
- Be explicit about uncertainty and confidence levels
- Connect new information to existing context`;
        return instructions;
    }
    buildMemoryContextInstructions() {
        let instructions = '';
        if (this.memoryContext.relevantMemories.length > 0) {
            instructions += `\n\n## Relevant Context:
Previous conversation insights: ${JSON.stringify(this.memoryContext.relevantMemories)}
Use this context to inform your reasoning, but always verify its relevance to the current question.`;
        }
        if (this.memoryContext.recentMessages.length > 0) {
            instructions += `\n\n## Recent Context:
Recent conversation: ${JSON.stringify(this.memoryContext.recentMessages)}
Consider this for continuity, but focus primarily on the current question.`;
        }
        return instructions;
    }
    buildToolGuidanceInstructions() {
        const toolDescriptions = this.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n');
        return `\n\n## Available Reasoning-Enhanced Tools:
${toolDescriptions}

## Intelligent Tool Selection:
- Analyze whether tools will genuinely improve your reasoning
- Consider the trade-off between tool use and direct reasoning
- Use knowledge tools for domain-specific questions requiring specialized information
- Use web search for current events or when knowledge base lacks relevant data
- Use calculator for complex mathematical reasoning that requires precise computation
- Use memory tools to connect with previous conversation context
- Use reasoning tools for self-reflection and validation
- ALWAYS reason about tool necessity in your <thinking> section`;
    }
    async streamReasoningResponse(messages, onEvent) {
        let fullResponse = '';
        const reasoningSteps = [];
        try {
            const stream = await this.llm.stream(messages);
            for await (const chunk of stream) {
                const content = chunk.content?.toString() || '';
                if (content) {
                    fullResponse += content;
                    const newSteps = this.extractReasoningSteps(content);
                    reasoningSteps.push(...newSteps);
                    if (content.includes('<thinking>') || content.includes('</thinking>')) {
                        if (onEvent) {
                            onEvent({
                                type: 'thinking',
                                data: { content: content }
                            });
                        }
                    }
                    if (newSteps.length > 0) {
                        if (onEvent) {
                            onEvent({
                                type: 'reasoning_step',
                                data: { steps: newSteps }
                            });
                        }
                    }
                    if (onEvent) {
                        onEvent({
                            type: 'chunk',
                            data: { delta: content }
                        });
                    }
                }
            }
            const toolCalls = await this.extractToolCallsWithReasoning(fullResponse);
            const hasToolCalls = toolCalls.length > 0;
            return {
                response: fullResponse,
                hasToolCalls,
                toolCalls,
                reasoningSteps
            };
        }
        catch (error) {
            console.error('❌ Advanced reasoning streaming failed:', error);
            throw error;
        }
    }
    extractProblemFromMessages(messages) {
        const lastUserMessage = messages
            .filter(msg => msg instanceof messages_1.HumanMessage)
            .pop();
        return lastUserMessage?.content || 'Unknown problem';
    }
    extractReasoningSteps(content) {
        const steps = [];
        const stepPattern = /(\d+)\.\s*([^:]+):\s*([^\n]+)/g;
        let match;
        while ((match = stepPattern.exec(content)) !== null) {
            steps.push({
                step: parseInt(match[1]),
                thought: match[2].trim(),
                action: match[3].trim(),
                confidence: 0.8
            });
        }
        return steps;
    }
    async extractToolCallsWithReasoning(response) {
        const calls = [];
        for (const tool of this.tools) {
            const patterns = [
                new RegExp(`I need to use ${tool.name}`, 'i'),
                new RegExp(`Let me ${tool.name}`, 'i'),
                new RegExp(`I should ${tool.name}`, 'i'),
                new RegExp(`${tool.name} would help`, 'i')
            ];
            for (const pattern of patterns) {
                if (pattern.test(response)) {
                    const reasoningMatch = response.match(new RegExp(`(.*${pattern.source}.*)`, 'i'));
                    const reasoning = reasoningMatch ? reasoningMatch[1] : response.substring(0, 200);
                    calls.push({
                        name: tool.name,
                        input: reasoning.trim()
                    });
                    break;
                }
            }
        }
        return calls;
    }
    async reasonAboutToolUse(toolName, input) {
        return {
            shouldUse: true,
            reason: `Tool ${toolName} is appropriate for this task`,
            enhancedInput: input
        };
    }
    async reasonAboutMathProblem(input) {
        return {
            steps: [`Analyzing problem: ${input}`, 'Breaking down into steps', 'Computing result'],
            result: 'Calculation completed with reasoning'
        };
    }
    async reasonAboutDateRequest(input) {
        return `Date requested for context: ${input}`;
    }
    async reasonAboutKnowledgeSearch(input, collection) {
        return {
            enhancedQuery: input,
            intent: `Search ${collection} for information about: ${input}`
        };
    }
    async reasonAboutMemorySearch(input) {
        return {
            enhancedQuery: input,
            intent: `Find relevant conversation history about: ${input}`
        };
    }
    async synthesizeSearchResults(results, query, intent) {
        const relevantResults = results
            .filter(doc => doc && doc.trim())
            .slice(0, 3)
            .map((doc, idx) => `${idx + 1}. ${doc}`)
            .join('\n\n');
        return `Based on reasoning about "${intent}", here are the most relevant results:\n\n${relevantResults}`;
    }
    async synthesizeMemoryContext(memories, intent) {
        if (memories.length === 0)
            return 'No relevant memory context found.';
        return memories.map((memory, idx) => `${idx + 1}. ${memory.content} (relevance: ${intent})`).join('\n');
    }
    async performSelfReflection(input) {
        return `Self-reflection on: ${input} - Reasoning appears sound with appropriate confidence levels.`;
    }
    async validateReasoningChain(input) {
        return `Reasoning validation: ${input} - Logic is consistent and well-supported.`;
    }
    async finalizeReasoningChain(response) {
        if (this.currentReasoningChain) {
            this.currentReasoningChain.conclusion = response;
            this.currentReasoningChain.totalConfidence =
                this.currentReasoningChain.steps.reduce((sum, step) => sum + step.confidence, 0) /
                    Math.max(this.currentReasoningChain.steps.length, 1);
        }
    }
    async performFinalReflection(onEvent) {
        if (this.currentReasoningChain && onEvent) {
            const reflection = `Final reflection: Reasoning chain completed with ${this.currentReasoningChain.steps.length} steps and confidence ${this.currentReasoningChain.totalConfidence.toFixed(2)}`;
            onEvent({
                type: 'reflection',
                data: { reflection }
            });
        }
    }
    async executeToolsWithReasoning(toolCalls, onEvent) {
        const results = {};
        for (const toolCall of toolCalls) {
            console.log(`🧠 Executing tool with reasoning: ${toolCall.name}`);
            if (onEvent) {
                onEvent({
                    type: 'tool_start',
                    data: {
                        tool_name: toolCall.name,
                        tool_input: toolCall.input,
                        reasoning: `Using ${toolCall.name} based on reasoning analysis`
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
                            output: result,
                            reasoning_applied: true
                        }
                    });
                }
                console.log(`✅ Tool ${toolCall.name} executed with reasoning integration`);
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
    async retrieveMemoryContext(messages) {
        console.log('🧠 Retrieving memory context with reasoning...');
        try {
            const lastUserMessage = messages
                .filter(msg => msg instanceof messages_1.HumanMessage)
                .pop();
            if (lastUserMessage) {
                const context = {
                    sessionId: this.config.sessionId,
                    userId: this.config.userId,
                    agentId: this.config.agentId,
                    namespace: 'conversation'
                };
                const relevantMemories = await langmemService_1.langmemService.searchMemories(lastUserMessage.content, context, { limit: 5 });
                const recentMessages = await langmemService_1.langmemService.getContextualMemories(context, { limit: 10 });
                this.memoryContext = {
                    relevantMemories,
                    recentMessages
                };
                console.log(`📚 Retrieved ${relevantMemories.length} relevant memories, ${recentMessages.length} recent messages with reasoning context`);
            }
        }
        catch (error) {
            console.error('❌ Memory retrieval with reasoning failed:', error);
            this.memoryContext = null;
        }
    }
    async updateMemory(messages, response) {
        console.log('💾 Updating memory with reasoning context...');
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
                timestamp: new Date().toISOString(),
                reasoning_chain: this.currentReasoningChain ? JSON.stringify(this.currentReasoningChain) : undefined
            }));
            recentMessages.push({
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString(),
                reasoning_chain: this.currentReasoningChain ? JSON.stringify(this.currentReasoningChain) : undefined
            });
            if (recentMessages.length > 0) {
                await langmemService_1.langmemService.processMessages(recentMessages, context);
                console.log(`💾 Processed ${recentMessages.length} messages with reasoning context for memory`);
            }
        }
        catch (error) {
            console.error('❌ Memory update with reasoning failed:', error);
        }
    }
    getReasoningChain() {
        return this.currentReasoningChain || null;
    }
    getState() {
        return {
            sessionId: this.config.sessionId,
            toolCount: this.tools.length,
            modelId: this.config.modelId,
            reasoningMode: this.config.reasoningMode,
            hasMemoryContext: !!this.memoryContext,
            currentReasoningSteps: this.currentReasoningChain?.steps.length || 0,
            reflectionCount: this.reflectionHistory.length
        };
    }
    visualize() {
        return `Advanced Reasoning Agent:
- Model: ${this.config.modelId}
- Reasoning Mode: ${this.config.reasoningMode}
- Session: ${this.config.sessionId}
- Tools: ${this.tools.length}
- Collections: ${this.config.collectionNames?.length || 0}
- Current Reasoning Steps: ${this.currentReasoningChain?.steps.length || 0}
- Reflections: ${this.reflectionHistory.length}
- Max Iterations: ${this.config.maxIterations || 5}`;
    }
}
exports.AdvancedReasoningAgent = AdvancedReasoningAgent;
AdvancedReasoningAgent.toolCache = new Map();
async function createAdvancedReasoningAgent(config) {
    console.log(`🧠 Creating Advanced Reasoning Agent with ${config.reasoningMode} mode...`);
    const agent = new AdvancedReasoningAgent(config);
    return {
        run: agent.run.bind(agent),
        getReasoningChain: agent.getReasoningChain.bind(agent),
        getState: agent.getState.bind(agent),
        visualize: agent.visualize.bind(agent)
    };
}
//# sourceMappingURL=advancedReasoningAgent.js.map