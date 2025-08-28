"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLangChainAgent = createLangChainAgent;
const agents_1 = require("langchain/agents");
const openai_1 = require("@langchain/openai");
const aws_1 = require("@langchain/aws");
const prompts_1 = require("@langchain/core/prompts");
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
const toolRegistry_1 = require("../services/toolRegistry");
const redis_1 = require("../lib/redis");
const memoryService_1 = require("../services/memoryService");
async function createLangChainAgent(config) {
    console.log(`🤖 Creating LangChain Agent with model: ${config.modelId}`);
    const llm = createLLM(config.modelId, {
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000
    });
    const allTools = config.tools || (0, toolRegistry_1.getAllTools)(config.sessionId || 'default', config.collections || []);
    const langchainTools = convertToolsToLangChain(allTools, config.sessionId);
    console.log(`🔧 Available tools for agent: ${langchainTools.map(t => t.name).join(', ')}`);
    const prompt = createAgentPrompt(config.systemPrompt);
    const agent = await (0, agents_1.createToolCallingAgent)({
        llm,
        tools: langchainTools,
        prompt
    });
    const agentExecutor = agents_1.AgentExecutor.fromAgentAndTools({
        agent,
        tools: langchainTools,
        verbose: true,
        maxIterations: 5
    });
    return {
        async run(messages, options) {
            console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
            const onEvent = options?.onEvent;
            const maxSteps = options?.maxSteps ?? 5;
            try {
                const langchainMessages = convertMessagesToLangChain(messages, config.systemPrompt);
                let contentReceived = false;
                let finalAnswer = '';
                const chatHistory = messages.slice(0, -1).map(msg => `${msg.role}: ${msg.content}`).join('\n');
                const agentInput = {
                    input: messages[messages.length - 1].content,
                    chat_history: chatHistory
                };
                const stream = await agentExecutor.stream(agentInput, {
                    callbacks: [
                        {
                            handleLLMStart: async (llm, prompts) => {
                                console.log(`🤖 LangChain LLM started`);
                            },
                            handleLLMNewToken: async (token) => {
                                console.log(`🤖 LangChain new token: ${token}`);
                                contentReceived = true;
                                if (onEvent)
                                    onEvent({ type: 'chunk', data: token });
                            },
                            handleLLMError: async (error) => {
                                console.error(`❌ LangChain LLM error: ${error}`);
                                if (onEvent)
                                    onEvent({ type: 'error', data: { error: error.message } });
                            },
                            handleChainStart: async (chain) => {
                                console.log(`🔗 LangChain chain started: ${chain.name}`);
                            },
                            handleChainEnd: async (output) => {
                                console.log(`🔗 LangChain chain ended`);
                            },
                            handleLLMEnd: async (output) => {
                                console.log(`🤖 LangChain LLM ended`);
                                finalAnswer = output.generations[0][0].text;
                                const generation = output.generations[0][0];
                                if (generation.tool_calls && generation.tool_calls.length > 0) {
                                    console.log(`🔧 Found ${generation.tool_calls.length} tool calls`);
                                    for (const toolCall of generation.tool_calls) {
                                        console.log(`🔧 Tool call: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}`);
                                    }
                                }
                            },
                            handleToolStart: async (tool) => {
                                console.log(`🔧 LangChain tool started: ${tool.name}`);
                                console.log(`🔧 Tool data: ${JSON.stringify(tool)}`);
                                if (onEvent)
                                    onEvent({
                                        type: 'tool_start',
                                        data: {
                                            tool_name: tool.name,
                                            tool_input: tool.input || ''
                                        }
                                    });
                            },
                            handleToolEnd: async (output) => {
                                const toolOutput = output.output || 'Tool completed successfully';
                                console.log(`🔧 LangChain tool ended: ${output.name} with result: ${toolOutput}`);
                                if (onEvent)
                                    onEvent({
                                        type: 'tool_result',
                                        data: {
                                            tool_name: output.name,
                                            output: toolOutput
                                        }
                                    });
                            },
                            handleToolError: async (error) => {
                                console.error(`❌ LangChain tool error: ${error}`);
                                if (onEvent)
                                    onEvent({ type: 'tool_error', data: { error: error.message } });
                            }
                        }
                    ]
                });
                for await (const chunk of stream) {
                    if (chunk.output) {
                        finalAnswer = chunk.output;
                    }
                }
                if (onEvent)
                    onEvent({ type: 'end', data: { answer: finalAnswer } });
                console.log(`🤖 LangChain Agent result: ${finalAnswer.substring(0, 100)}...`);
                return finalAnswer;
            }
            catch (error) {
                console.error('❌ Error in LangChain Agent:', error);
                throw error;
            }
        }
    };
}
async function setupHybridMemory(sessionId, messages) {
    try {
        console.log(`🧠 Setting up hybrid memory for session ${sessionId}`);
        const recentMessages = messages.slice(-10);
        if (recentMessages.length > 0) {
            await redis_1.redis.set(`chat:recent:${sessionId}`, JSON.stringify(recentMessages), 'EX', 86400);
            console.log(`💾 Stored ${recentMessages.length} recent messages in Redis`);
        }
        if (messages.length % 10 === 0 && messages.length > 0) {
            const messagesForEmbedding = messages.map(msg => ({
                content: msg.content,
                role: msg.role,
                timestamp: new Date().toISOString()
            }));
            for (const msg of messagesForEmbedding) {
                await memoryService_1.memoryService.embedMessage(sessionId, msg.content);
            }
            console.log(`📚 Embedded ${messagesForEmbedding.length} messages to vectorstore`);
        }
    }
    catch (error) {
        console.error(`❌ Error setting up hybrid memory: ${error}`);
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
function convertToolsToLangChain(tools, sessionId) {
    const langchainTools = [];
    console.log(`🔧 Converting ${Object.keys(tools).length} tools to LangChain format`);
    console.log(`🔧 Session ID: ${sessionId}`);
    for (const [name, toolFn] of Object.entries(tools)) {
        let description = toolRegistry_1.toolMetadata[name]?.description || `Tool: ${name}`;
        if (name.startsWith('search_chat_memory_')) {
            description = 'Search this chat session memory. Input: search terms';
        }
        else if (name.startsWith('search_')) {
            description = 'Search knowledge base. Input: search query';
        }
        console.log(`🔧 Creating LangChain tool: ${name} - ${description.substring(0, 50)}...`);
        const langchainTool = new tools_1.DynamicTool({
            name,
            description,
            func: async (input) => {
                try {
                    console.log(`🔧 LangChain Tool called: ${name} with input: ${input}`);
                    const result = await toolFn(input, sessionId || '');
                    console.log(`🔧 LangChain Tool result: ${result.substring(0, 100)}...`);
                    return result;
                }
                catch (error) {
                    console.error(`❌ LangChain Tool error: ${name}`, error);
                    if (name === 'web_search') {
                        return 'Web search is currently unavailable. Please try again later.';
                    }
                    else if (name === 'calculator') {
                        return 'Calculator error. Please check your mathematical expression.';
                    }
                    else if (name.startsWith('memory_')) {
                        return 'Memory service is currently unavailable.';
                    }
                    else {
                        return `Error executing tool ${name}: ${error}`;
                    }
                }
            }
        });
        langchainTools.push(langchainTool);
    }
    return langchainTools;
}
function createAgentPrompt(systemPrompt) {
    const defaultPrompt = "You are a helpful AI assistant with access to tools.";
    const finalSystemPrompt = systemPrompt || defaultPrompt;
    const improvedPrompt = `${finalSystemPrompt}

EXECUTION PROCESS:
1. Understand the user's request clearly
2. Determine what information or tools are needed
3. Use appropriate tools with correct inputs
4. Provide clear, helpful responses

TOOL USAGE:
- web_search: For current information, news, facts (input: search query)
- calculator: For math calculations (input: mathematical expression)
- knowledge_search: For specific domain knowledge (input: query)
- memory tools: For conversation context

RULES:
- Actually use tools when needed, don't just mention them
- Show your reasoning process
- Provide accurate, complete answers
- If tools fail, try alternatives`;
    return prompts_1.ChatPromptTemplate.fromMessages([
        ["system", improvedPrompt],
        ["human", "Previous: {chat_history}\nCurrent: {input}\nThinking: {agent_scratchpad}"]
    ]);
}
function convertMessagesToLangChain(messages, systemPrompt) {
    const langchainMessages = [];
    if (systemPrompt) {
        langchainMessages.push(new messages_1.SystemMessage(systemPrompt));
    }
    for (const message of messages) {
        if (message.role === 'user') {
            langchainMessages.push(new messages_1.HumanMessage(message.content));
        }
        else if (message.role === 'assistant') {
            langchainMessages.push(new messages_1.AIMessage(message.content));
        }
    }
    return langchainMessages;
}
//# sourceMappingURL=langchainAgentFactory.js.map