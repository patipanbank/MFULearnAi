"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSimpleLangGraphAgent = createSimpleLangGraphAgent;
const messages_1 = require("@langchain/core/messages");
const aws_1 = require("@langchain/aws");
const openai_1 = require("@langchain/openai");
const tools_1 = require("@langchain/core/tools");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
const langmemService_1 = require("../services/langmemService");
async function createSimpleLangGraphAgent(config) {
    console.log(`🤖 Creating Simple LangGraph Agent with model: ${config.modelId}`);
    const llm = createLLM(config.modelId, {
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000
    });
    const toolContext = {
        sessionId: config.sessionId,
        userId: config.userId,
        agentId: config.agentId,
        collectionNames: config.collectionNames || [],
        config: config
    };
    let availableTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(toolContext);
    if (config.allowedTools && config.allowedTools.length > 0) {
        availableTools = availableTools.filter(tool => config.allowedTools.includes(tool.id) ||
            config.allowedTools.includes(tool.name.toLowerCase().replace(/\s+/g, '_')));
    }
    const tools = convertToLangChainTools(availableTools, toolContext);
    const toolMap = new Map(tools.map(tool => [tool.name, tool]));
    console.log(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);
    let currentState = {
        messages: [],
        sessionId: config.sessionId,
        userId: config.userId,
        memoryContext: null,
        toolResults: {},
        iterations: 0,
        reasoning: []
    };
    return {
        async run(messages, options) {
            console.log(`🤖 Simple LangGraph Agent.run called with ${messages.length} messages`);
            const onEvent = options?.onEvent;
            const maxSteps = options?.maxSteps || config.maxIterations || 5;
            try {
                const langchainMessages = convertMessagesToLangChain(messages);
                currentState.messages = langchainMessages;
                console.log(`🤖 Converted ${messages.length} input messages to ${langchainMessages.length} valid LangChain messages`);
                langchainMessages.forEach((msg, i) => {
                    console.log(`🤖 Message ${i}: ${msg.constructor.name} - "${msg.content?.toString().substring(0, 50)}..."`);
                });
                if (onEvent) {
                    onEvent({
                        type: 'assistant_created',
                        data: {
                            messageId: Math.random().toString(36).substr(2, 9),
                            content: ''
                        }
                    });
                }
                await memoryRetrievalStep();
                let finalAnswer = '';
                let iterations = 0;
                while (iterations < maxSteps) {
                    iterations++;
                    console.log(`🔄 Agent iteration ${iterations}/${maxSteps}`);
                    const agentResponse = await agentReasoningStep();
                    const toolCalls = extractToolCalls(agentResponse);
                    if (toolCalls.length === 0) {
                        finalAnswer = agentResponse.content.toString();
                        break;
                    }
                    for (const toolCall of toolCalls) {
                        await executeToolStep(toolCall, onEvent);
                    }
                    currentState.messages.push(agentResponse);
                }
                await memoryUpdateStep();
                if (onEvent && finalAnswer) {
                    const words = finalAnswer.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        const chunk = (i > 0 ? ' ' : '') + words[i];
                        onEvent({
                            type: 'chunk',
                            data: {
                                messageId: Math.random().toString(36).substr(2, 9),
                                delta: chunk
                            }
                        });
                        await new Promise(resolve => setTimeout(resolve, 20));
                    }
                }
                if (onEvent) {
                    onEvent({
                        type: 'end',
                        data: {
                            messageId: Math.random().toString(36).substr(2, 9),
                            answer: finalAnswer,
                            inputTokens: 0,
                            outputTokens: 0,
                            reasoning: currentState.reasoning
                        }
                    });
                }
                console.log(`🤖 Simple LangGraph execution completed. Result: ${finalAnswer.substring(0, 100)}...`);
                return finalAnswer;
            }
            catch (error) {
                console.error('❌ Error in Simple LangGraph Agent:', error);
                if (onEvent) {
                    onEvent({
                        type: 'error',
                        data: { error: error.message }
                    });
                }
                throw error;
            }
        },
        getState: () => currentState,
        visualize: () => `
      Simple LangGraph Agent Workflow:
      1. Memory Retrieval → 2. Agent Reasoning → 3. Tool Execution (if needed) → 4. Memory Update

      Current State:
      - Messages: ${currentState.messages.length}
      - Iterations: ${currentState.iterations}
      - Session: ${currentState.sessionId}
    `
    };
    async function memoryRetrievalStep() {
        console.log('🧠 Memory Retrieval Step');
        if (!config.sessionId) {
            currentState.reasoning.push('No session ID - skipping memory retrieval');
            return;
        }
        try {
            const lastUserMessage = [...currentState.messages]
                .reverse()
                .find(msg => msg instanceof messages_1.HumanMessage);
            if (lastUserMessage) {
                const context = await langmemService_1.langmemService.getConversationContext(config.sessionId, lastUserMessage.content.toString());
                const relevantMemories = await langmemService_1.langmemService.searchMemory(config.sessionId, lastUserMessage.content.toString(), 5);
                currentState.memoryContext = { context, relevantMemories };
                currentState.reasoning.push('Retrieved conversation context and relevant memories');
            }
        }
        catch (error) {
            console.warn('Memory retrieval failed:', error);
            currentState.reasoning.push('Memory retrieval failed - proceeding without context');
        }
    }
    async function agentReasoningStep() {
        console.log('🤖 Agent Reasoning Step');
        let enhancedSystemPrompt = config.systemPrompt;
        if (currentState.memoryContext) {
            enhancedSystemPrompt += `\n\nConversation Context: ${JSON.stringify(currentState.memoryContext.context)}`;
            enhancedSystemPrompt += `\nRelevant Memories: ${JSON.stringify(currentState.memoryContext.relevantMemories)}`;
        }
        if (Object.keys(currentState.toolResults).length > 0) {
            enhancedSystemPrompt += `\n\nTool Results: ${JSON.stringify(currentState.toolResults)}`;
        }
        enhancedSystemPrompt += `\n\nAvailable Tools: ${tools.map(t => `${t.name}: ${t.description}`).join(', ')}`;
        const systemMessage = new messages_1.SystemMessage(enhancedSystemPrompt);
        const validMessages = currentState.messages.filter(msg => {
            const content = msg.content?.toString().trim();
            return content && content.length > 0;
        });
        console.log(`🤖 Sending ${validMessages.length + 1} messages to LLM (including system)`);
        const response = await llm.invoke([systemMessage, ...validMessages]);
        currentState.reasoning.push(`Agent responded - checking for tool calls`);
        return response;
    }
    function extractToolCalls(message) {
        const content = message.content.toString();
        const toolCalls = [];
        if (message.tool_calls) {
            return message.tool_calls.map((call) => ({
                name: call.name,
                input: JSON.stringify(call.args)
            }));
        }
        for (const tool of tools) {
            const usePattern = new RegExp(`use ${tool.name}\\(([^)]+)\\)`, 'i');
            const useMatch = content.match(usePattern);
            if (useMatch) {
                toolCalls.push({
                    name: tool.name,
                    input: useMatch[1]
                });
                continue;
            }
            const toolPattern = new RegExp(`Tool:\\s*${tool.name}[\\s\\S]*?(?:Query|Input):\\s*(.+?)(?=\\n|$)`, 'i');
            const toolMatch = content.match(toolPattern);
            if (toolMatch) {
                toolCalls.push({
                    name: tool.name,
                    input: toolMatch[1].trim()
                });
                continue;
            }
            const simplePattern = new RegExp(`${tool.name}[\\s\\S]*?(?:query|search|input)[:\\s]+(.+?)(?=\\n|$)`, 'i');
            const simpleMatch = content.match(simplePattern);
            if (simpleMatch) {
                toolCalls.push({
                    name: tool.name,
                    input: simpleMatch[1].trim()
                });
            }
        }
        return toolCalls;
    }
    async function executeToolStep(toolCall, onEvent) {
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
            const tool = toolMap.get(toolCall.name);
            if (!tool) {
                throw new Error(`Tool ${toolCall.name} not found`);
            }
            const result = await tool.func(toolCall.input);
            currentState.toolResults[toolCall.name] = result;
            currentState.reasoning.push(`Executed ${toolCall.name} successfully`);
            if (onEvent) {
                onEvent({
                    type: 'tool_result',
                    data: {
                        tool_name: toolCall.name,
                        output: result
                    }
                });
            }
            const toolMessage = new messages_1.AIMessage(`Tool ${toolCall.name} result: ${result}`);
            currentState.messages.push(toolMessage);
        }
        catch (error) {
            console.error(`Tool ${toolCall.name} failed:`, error);
            currentState.reasoning.push(`Tool ${toolCall.name} failed: ${error.message}`);
            if (onEvent) {
                onEvent({
                    type: 'tool_error',
                    data: {
                        tool_name: toolCall.name,
                        error: error.message
                    }
                });
            }
        }
    }
    async function memoryUpdateStep() {
        console.log('💾 Memory Update Step');
        if (!config.sessionId) {
            return;
        }
        try {
            const recentMessages = currentState.messages.slice(-2);
            for (const message of recentMessages) {
                await langmemService_1.langmemService.addMessage(config.sessionId, {
                    role: message instanceof messages_1.HumanMessage ? 'user' : 'assistant',
                    content: message.content.toString(),
                    timestamp: new Date().toISOString()
                });
            }
            currentState.reasoning.push('Updated conversation memory');
        }
        catch (error) {
            console.warn('Memory update failed:', error);
        }
    }
}
function createLLM(modelId, config) {
    if (modelId.includes('anthropic') || modelId.includes('claude')) {
        return new aws_1.ChatBedrockConverse({
            model: modelId,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            region: process.env.AWS_REGION || 'us-east-1'
        });
    }
    else if (modelId.includes('gpt') || modelId.includes('openai')) {
        return new openai_1.ChatOpenAI({
            modelName: modelId,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            openAIApiKey: process.env.OPENAI_API_KEY
        });
    }
    else {
        return new aws_1.ChatBedrockConverse({
            model: modelId,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            region: process.env.AWS_REGION || 'us-east-1'
        });
    }
}
function convertToLangChainTools(toolConfigs, context) {
    return toolConfigs.map(config => new tools_1.DynamicTool({
        name: config.id,
        description: config.description || `Tool: ${config.id}`,
        func: async (input) => {
            try {
                const result = await unifiedToolRegistry_1.unifiedToolRegistry.executeTool(config.id, input, context);
                return result.success ? result.result : result.error || 'Tool execution failed';
            }
            catch (error) {
                return `Tool error: ${error.message}`;
            }
        }
    }));
}
function convertMessagesToLangChain(messages) {
    return messages
        .filter(msg => msg.content && msg.content.trim().length > 0)
        .map(msg => {
        if (msg.role === 'user') {
            return new messages_1.HumanMessage(msg.content);
        }
        else {
            return new messages_1.AIMessage(msg.content);
        }
    });
}
//# sourceMappingURL=simpleLanggraphAgent.js.map