"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
const langgraphAgent_1 = require("./langgraphAgent");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
async function createAgent(llm, tools, prompt, config) {
    console.log(`🤖 Creating LangGraph Agent with prompt: ${prompt.substring(0, 50)}...`);
    const toolContext = {
        sessionId: config?.sessionId,
        userId: config?.userId,
        agentId: config?.agentId,
        collectionNames: config?.collectionNames || [],
        config: config
    };
    let availableTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(toolContext);
    if (config?.allowedTools && config.allowedTools.length > 0) {
        console.log(`🔧 Filtering tools to allowed list: ${config.allowedTools.join(', ')}`);
        availableTools = availableTools.filter(tool => config.allowedTools.includes(tool.id) ||
            config.allowedTools.includes(tool.name.toLowerCase().replace(/\s+/g, '_')));
    }
    if (config?.sessionId) {
        unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(config.sessionId);
    }
    if (config?.collectionNames && config.collectionNames.length > 0) {
        unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(config.collectionNames);
    }
    const unifiedTools = convertUnifiedToolsToLegacy(availableTools, toolContext);
    let filteredLegacyTools = tools;
    if (config?.allowedTools && config.allowedTools.length > 0) {
        filteredLegacyTools = {};
        for (const [toolName, toolFunc] of Object.entries(tools)) {
            if (config.allowedTools.includes(toolName) ||
                config.allowedTools.includes(toolName.toLowerCase().replace(/\s+/g, '_'))) {
                filteredLegacyTools[toolName] = toolFunc;
            }
        }
    }
    const allTools = { ...filteredLegacyTools, ...unifiedTools };
    console.log(`🔧 Total tools available: ${Object.keys(allTools).length}`);
    console.log(`🔧 Tools: ${Object.keys(allTools).join(', ')}`);
    if (config?.allowedTools && config.allowedTools.length > 0) {
        console.log(`✅ Tools are filtered by agent configuration`);
    }
    else {
        console.log(`⚠️ No tool filtering applied - agent will have access to ALL tools`);
    }
    const langgraphAgent = await (0, langgraphAgent_1.createLangGraphAgent)({
        modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        systemPrompt: prompt,
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 4000,
        collectionNames: config?.collectionNames || [],
        sessionId: config?.sessionId || 'default',
        tools: allTools
    });
    return {
        async run(messages, options) {
            console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
            console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
            console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);
            try {
                if (options?.images && options.images.length > 0 && options.images.some(img => img.base64Data)) {
                    console.log(`🤖 Using multimodal approach with ${options.images.length} images`);
                    const lastUserMessage = messages.slice().reverse().find((msg) => msg.role === 'user');
                    if (lastUserMessage) {
                        const messageId = Math.random().toString(36).substr(2, 9);
                        if (options.onEvent) {
                            options.onEvent({
                                type: 'assistant_created',
                                data: {
                                    messageId: messageId,
                                    content: ''
                                }
                            });
                        }
                        const response = await llm.generate(lastUserMessage.content, options.images);
                        if (options.onEvent && response) {
                            const words = response.split(' ');
                            for (let i = 0; i < words.length; i++) {
                                const chunk = (i > 0 ? ' ' : '') + words[i];
                                options.onEvent({
                                    type: 'chunk',
                                    data: {
                                        messageId: messageId,
                                        delta: chunk
                                    }
                                });
                                await new Promise(resolve => setTimeout(resolve, 30));
                            }
                            options.onEvent({
                                type: 'end',
                                data: {
                                    messageId: messageId,
                                    answer: response,
                                    inputTokens: 0,
                                    outputTokens: 0
                                }
                            });
                        }
                        return response;
                    }
                }
                const lastUserMessage = messages[messages.length - 1]?.content || '';
                const baseMessages = messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                let fullAnswer = '';
                const result = await langgraphAgent.run(lastUserMessage, [], (chunk) => {
                    fullAnswer = chunk;
                    if (options?.onEvent) {
                        options.onEvent({
                            type: 'chunk',
                            data: chunk
                        });
                    }
                });
                if (options?.onEvent) {
                    options.onEvent({
                        type: 'end',
                        data: {
                            answer: result.answer,
                            metadata: result.metadata,
                            toolsUsed: result.toolsUsed
                        }
                    });
                }
                return result.answer;
            }
            catch (error) {
                console.error('❌ Error in LangGraph Agent:', error);
                throw error;
            }
            finally {
                if (config?.sessionId) {
                }
            }
        }
    };
}
function convertUnifiedToolsToLegacy(toolConfigs, context) {
    const legacyTools = {};
    for (const config of toolConfigs) {
        legacyTools[config.id] = async (input, sessionId, legacyConfig) => {
            try {
                const result = await unifiedToolRegistry_1.unifiedToolRegistry.executeTool(config.id, input, {
                    ...context,
                    sessionId: sessionId || context.sessionId,
                    config: { ...context.config, ...legacyConfig }
                });
                if (result.success) {
                    return result.result;
                }
                else {
                    return result.error || 'Tool execution failed';
                }
            }
            catch (error) {
                return `Tool error: ${error.message}`;
            }
        };
    }
    return legacyTools;
}
//# sourceMappingURL=agentFactory.js.map