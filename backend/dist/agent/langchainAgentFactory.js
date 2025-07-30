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
                                if (onEvent)
                                    onEvent({ type: 'chunk', data: 'กำลังประมวลผล...' });
                            },
                            handleLLMNewToken: async (token) => {
                                console.log(`🤖 LangChain new token: ${token}`);
                                if (onEvent)
                                    onEvent({ type: 'chunk', data: token });
                            },
                            handleLLMEnd: async (output) => {
                                console.log(`🤖 LangChain LLM ended`);
                                if (onEvent)
                                    onEvent({ type: 'end', data: { answer: output.generations[0][0].text } });
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
        const langchainTool = new tools_1.DynamicTool({
            name,
            description: `Tool: ${name}`,
            func: async (input) => {
                try {
                    console.log(`🔧 LangChain Tool called: ${name} with input: ${input}`);
                    const result = await toolFn(input, sessionId || '');
                    console.log(`🔧 LangChain Tool result: ${result.substring(0, 100)}...`);
                    return result;
                }
                catch (error) {
                    console.error(`❌ LangChain Tool error: ${name}`, error);
                    return `Error executing tool ${name}: ${error}`;
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

You have access to various tools to help answer questions. When you need to use a tool, the system will automatically provide it for you.

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