"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLangChainAgent = createLangChainAgent;
const agents_1 = require("langchain/agents");
const openai_1 = require("@langchain/openai");
const aws_1 = require("@langchain/aws");
const prompts_1 = require("@langchain/core/prompts");
const messages_1 = require("@langchain/core/messages");
const tools_1 = require("@langchain/core/tools");
async function createLangChainAgent(config) {
    console.log(`🤖 Creating LangChain Agent with model: ${config.modelId}`);
    const llm = createLLM(config.modelId, {
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000
    });
    const langchainTools = convertToolsToLangChain(config.tools, config.sessionId);
    const prompt = createAgentPrompt(config.systemPrompt);
    const agent = await (0, agents_1.createOpenAIFunctionsAgent)({
        llm,
        tools: langchainTools,
        prompt
    });
    const agentExecutor = agents_1.AgentExecutor.fromAgentAndTools({
        agent,
        tools: langchainTools,
        verbose: true
    });
    return {
        async run(messages, options) {
            console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
            const onEvent = options?.onEvent;
            const maxSteps = options?.maxSteps ?? 5;
            try {
                const langchainMessages = convertMessagesToLangChain(messages, config.systemPrompt);
                const result = await agentExecutor.invoke({
                    input: langchainMessages,
                    maxIterations: maxSteps
                }, {
                    callbacks: [
                        {
                            handleLLMStart: async (llm, prompts) => {
                                console.log(`🤖 LangChain LLM started`);
                            },
                            handleLLMNewToken: async (token) => {
                                console.log(`🤖 LangChain new token: ${token}`);
                                if (onEvent)
                                    onEvent({ type: 'chunk', data: token });
                            },
                            handleLLMEnd: async (output) => {
                                console.log(`🤖 LangChain LLM ended`);
                                const finalAnswer = output.generations[0][0].text;
                                if (onEvent)
                                    onEvent({ type: 'end', data: { answer: finalAnswer } });
                            },
                            handleToolStart: async (tool) => {
                                console.log(`🔧 LangChain tool started: ${tool.name}`);
                                if (onEvent)
                                    onEvent({ type: 'tool_start', data: { tool_name: tool.name } });
                            },
                            handleToolEnd: async (output) => {
                                console.log(`🔧 LangChain tool ended: ${output.name}`);
                                if (onEvent)
                                    onEvent({ type: 'tool_result', data: { tool_name: output.name, output: output.output } });
                            },
                            handleToolError: async (error) => {
                                console.error(`❌ LangChain tool error: ${error}`);
                                if (onEvent)
                                    onEvent({ type: 'tool_error', data: { error: error.message } });
                            }
                        }
                    ]
                });
                console.log(`🤖 LangChain Agent result: ${result.output.substring(0, 100)}...`);
                return result.output;
            }
            catch (error) {
                console.error('❌ Error in LangChain Agent:', error);
                throw error;
            }
        }
    };
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
    for (const [name, toolFn] of Object.entries(tools)) {
        let description = `Tool: ${name}`;
        if (name === 'web_search') {
            description = 'Search the web for current information. Use this tool when you need to find recent or up-to-date information about any topic. Input should be a search query.';
        }
        else if (name === 'calculator') {
            description = 'Perform mathematical calculations. Use this tool when you need to solve math problems or perform calculations. Input should be a mathematical expression.';
        }
        else if (name === 'current_date') {
            description = 'Get the current date and time. Use this tool when you need to know the current date or time.';
        }
        else if (name === 'memory_search') {
            description = 'Search through conversation memory to find relevant context from previous messages. Use this tool when you need to recall information from earlier in the conversation.';
        }
        else if (name === 'memory_embed') {
            description = 'Embed new information into conversation memory for future reference. Use this tool to store important information from the current conversation.';
        }
        else if (name.startsWith('search_chat_memory_')) {
            description = 'Search through the current chat session history to find relevant context. Use this tool to recall information from this specific conversation.';
        }
        else if (name.startsWith('embed_chat_memory_')) {
            description = 'Embed new message into chat memory for this session. Use this tool to store important information from the current conversation.';
        }
        else if (name.startsWith('recent_context_')) {
            description = 'Get recent context from memory (last 10 messages). Use this tool to get a summary of recent conversation history.';
        }
        else if (name.startsWith('full_context_')) {
            description = 'Get full conversation context from memory. Use this tool to get the complete conversation history.';
        }
        else if (name.startsWith('clear_memory_')) {
            description = 'Clear all chat memory for this session. Use this tool to reset the conversation memory.';
        }
        else if (name.startsWith('memory_stats_')) {
            description = 'Get memory usage statistics for this session. Use this tool to check memory usage.';
        }
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
    const template = prompts_1.ChatPromptTemplate.fromMessages([
        ["system", `You are a helpful AI assistant. Follow these guidelines:

${systemPrompt}

You have access to the following tools:
- web_search: Search the web for current information
- calculator: Perform mathematical calculations
- current_date: Get current date and time
- memory_search: Search conversation memory
- memory_embed: Store information in memory
- Various session-specific memory tools

IMPORTANT INSTRUCTIONS:
1. If the user asks you to search for information, you MUST use the web_search tool
2. If the user asks for calculations, use the calculator tool
3. If you need to recall previous conversation context, use memory tools
4. Always use the appropriate tool when needed - do not try to answer without tools
5. When using web_search, provide the search query as input
6. When using calculator, provide the mathematical expression as input

Please provide clear, helpful responses to user questions.`],
        ["human", "Question: {input}\nThought: {agent_scratchpad}"]
    ]);
    return template;
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