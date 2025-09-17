"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLangGraphAgent = createLangGraphAgent;
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const aws_1 = require("@langchain/aws");
const openai_1 = require("@langchain/openai");
const tools_1 = require("@langchain/core/tools");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const messages_2 = require("@langchain/core/messages");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
const langmemService_1 = require("../services/langmemService");
async function createLangGraphAgent(config) {
    console.log(`🤖 Creating LangGraph Agent with model: ${config.modelId}`);
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
    const toolNode = new prebuilt_1.ToolNode(tools);
    console.log(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);
    const workflow = new langgraph_1.StateGraph({
        channels: {
            messages: {
                reducer: (current, update) => {
                    return [...current, ...update];
                },
                default: () => []
            },
            sessionId: {
                reducer: (current, update) => update || current,
                default: () => config.sessionId
            },
            userId: {
                reducer: (current, update) => update || current,
                default: () => config.userId
            },
            agentId: {
                reducer: (current, update) => update || current,
                default: () => config.agentId
            },
            collectionNames: {
                reducer: (current, update) => update.length > 0 ? update : current,
                default: () => config.collectionNames || []
            },
            memoryContext: {
                reducer: (current, update) => update || current,
                default: () => null
            },
            toolResults: {
                reducer: (current, update) => ({
                    ...current,
                    ...update
                }),
                default: () => ({})
            },
            iterations: {
                reducer: (current, update) => update,
                default: () => 0
            },
            maxIterations: {
                reducer: (current, update) => update || current,
                default: () => config.maxIterations || 5
            },
            finalAnswer: {
                reducer: (current, update) => update || current,
                default: () => undefined
            },
            reasoning: {
                reducer: (current, update) => [...current, ...update],
                default: () => []
            },
            sources: {
                reducer: (current, update) => [...new Set([...current, ...update])],
                default: () => []
            },
            confidence: {
                reducer: (current, update) => update || current,
                default: () => 0.8
            }
        }
    });
    workflow.addNode('memory_retrieval', memoryRetrievalNode);
    workflow.addNode('agent', agentNode.bind(null, llm, config.systemPrompt));
    workflow.addNode('tools', toolNode);
    workflow.addNode('memory_update', memoryUpdateNode);
    workflow.addEdge(langgraph_1.START, 'memory_retrieval');
    workflow.addEdge('memory_retrieval', 'agent');
    workflow.addConditionalEdges('agent', shouldContinue, {
        'continue': 'tools',
        'end': 'memory_update'
    });
    workflow.addEdge('tools', 'agent');
    workflow.addEdge('memory_update', langgraph_1.END);
    const app = workflow.compile();
    let currentState = null;
    return {
        async run(messages, options) {
            console.log(`🤖 LangGraph Agent.run called with ${messages.length} messages`);
            const onEvent = options?.onEvent;
            const maxSteps = options?.maxSteps || config.maxIterations || 5;
            try {
                const langchainMessages = convertMessagesToLangChain(messages);
                const initialState = {
                    messages: langchainMessages,
                    sessionId: config.sessionId,
                    userId: config.userId,
                    agentId: config.agentId,
                    collectionNames: config.collectionNames || [],
                    toolResults: {},
                    iterations: 0,
                    maxIterations: maxSteps,
                    reasoning: [],
                    sources: [],
                    confidence: 0.8
                };
                let finalResult = '';
                if (onEvent) {
                    onEvent({
                        type: 'assistant_created',
                        data: {
                            messageId: Math.random().toString(36).substr(2, 9),
                            content: ''
                        }
                    });
                }
                const stream = await app.stream(initialState, {
                    recursionLimit: maxSteps
                });
                for await (const chunk of stream) {
                    currentState = chunk[Object.keys(chunk)[0]];
                    const nodeKey = Object.keys(chunk)[0];
                    if (nodeKey === 'agent' && onEvent) {
                        const lastMessage = currentState.messages[currentState.messages.length - 1];
                        if (lastMessage instanceof messages_1.AIMessage) {
                            const words = lastMessage.content.toString().split(' ');
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
                    }
                    if (nodeKey === 'tools' && onEvent) {
                        const lastMessage = currentState.messages[currentState.messages.length - 1];
                        if (lastMessage instanceof messages_2.ToolMessage) {
                            onEvent({
                                type: 'tool_result',
                                data: {
                                    tool_name: lastMessage.name,
                                    output: lastMessage.content
                                }
                            });
                        }
                    }
                    if (currentState.finalAnswer) {
                        finalResult = currentState.finalAnswer;
                    }
                    else {
                        const lastAIMessage = [...currentState.messages]
                            .reverse()
                            .find(msg => msg instanceof messages_1.AIMessage);
                        if (lastAIMessage) {
                            finalResult = lastAIMessage.content.toString();
                        }
                    }
                }
                if (onEvent) {
                    onEvent({
                        type: 'end',
                        data: {
                            messageId: Math.random().toString(36).substr(2, 9),
                            answer: finalResult,
                            inputTokens: 0,
                            outputTokens: 0,
                            reasoning: currentState?.reasoning || [],
                            sources: currentState?.sources || [],
                            confidence: currentState?.confidence || 0.8
                        }
                    });
                }
                console.log(`🤖 LangGraph execution completed. Result: ${finalResult.substring(0, 100)}...`);
                return finalResult;
            }
            catch (error) {
                console.error('❌ Error in LangGraph Agent:', error);
                if (onEvent) {
                    onEvent({
                        type: 'error',
                        data: { error: error.message }
                    });
                }
                throw error;
            }
        },
        getState() {
            return currentState;
        },
        visualize() {
            try {
                return app.getGraph().drawMermaid();
            }
            catch (error) {
                console.warn('Graph visualization not available:', error);
                return 'Graph visualization not available';
            }
        }
    };
}
async function memoryRetrievalNode(state) {
    console.log('🧠 Memory Retrieval Node');
    if (!state.sessionId) {
        return { memoryContext: null };
    }
    try {
        const lastUserMessage = [...state.messages]
            .reverse()
            .find(msg => msg instanceof messages_1.HumanMessage);
        if (lastUserMessage) {
            const context = await langmemService_1.langmemService.getConversationContext(state.sessionId, lastUserMessage.content.toString());
            const relevantMemories = await langmemService_1.langmemService.searchMemory(state.sessionId, lastUserMessage.content.toString(), 5);
            return {
                memoryContext: { context, relevantMemories },
                reasoning: [...state.reasoning, 'Retrieved conversation context and relevant memories']
            };
        }
    }
    catch (error) {
        console.warn('Memory retrieval failed:', error);
    }
    return { memoryContext: null };
}
async function agentNode(llm, systemPrompt, state) {
    console.log(`🤖 Agent Node - Iteration ${state.iterations + 1}`);
    let enhancedSystemPrompt = systemPrompt;
    if (state.memoryContext) {
        enhancedSystemPrompt += `\n\nConversation Context: ${JSON.stringify(state.memoryContext.context)}`;
        enhancedSystemPrompt += `\nRelevant Memories: ${JSON.stringify(state.memoryContext.relevantMemories)}`;
    }
    if (Object.keys(state.toolResults).length > 0) {
        enhancedSystemPrompt += `\n\nTool Results: ${JSON.stringify(state.toolResults)}`;
    }
    const systemMessage = new messages_1.BaseMessage({
        content: enhancedSystemPrompt,
        additional_kwargs: { role: 'system' }
    });
    const response = await llm.invoke([systemMessage, ...state.messages]);
    const toolCalls = response.tool_calls || [];
    const newMessages = [response];
    return {
        messages: newMessages,
        iterations: state.iterations + 1,
        reasoning: [...state.reasoning, `Agent responded with ${toolCalls.length} tool calls`]
    };
}
async function memoryUpdateNode(state) {
    console.log('💾 Memory Update Node');
    if (!state.sessionId) {
        return {};
    }
    try {
        const recentMessages = state.messages.slice(-2);
        for (const message of recentMessages) {
            await langmemService_1.langmemService.addMessage(state.sessionId, {
                role: message instanceof messages_1.HumanMessage ? 'user' : 'assistant',
                content: message.content.toString(),
                timestamp: new Date().toISOString()
            });
        }
        return {
            reasoning: [...state.reasoning, 'Updated conversation memory']
        };
    }
    catch (error) {
        console.warn('Memory update failed:', error);
        return {};
    }
}
function shouldContinue(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (state.iterations >= state.maxIterations) {
        return 'end';
    }
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return 'continue';
    }
    return 'end';
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
    return messages.map(msg => {
        if (msg.role === 'user') {
            return new messages_1.HumanMessage(msg.content);
        }
        else {
            return new messages_1.AIMessage(msg.content);
        }
    });
}
//# sourceMappingURL=langgraphAgentFactory.js.map