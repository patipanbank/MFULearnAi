"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.langchainChatService = exports.LangChainChatService = void 0;
const messages_1 = require("@langchain/core/messages");
const redis_1 = require("@langchain/community/stores/message/redis");
const runnables_1 = require("@langchain/core/runnables");
const output_parsers_1 = require("@langchain/core/output_parsers");
const redis_2 = require("redis");
const llmFactory_1 = require("../agents/llmFactory");
const promptFactory_1 = require("../agents/promptFactory");
const agentFactory_1 = require("../agents/agentFactory");
const toolRegistry_1 = require("../agents/toolRegistry");
const usageService_1 = require("./usageService");
const chat_1 = require("../models/chat");
class LangChainChatService {
    async clearChatMemory(sessionId) {
        try {
            const redisUrl = process.env.REDIS_URL;
            if (redisUrl) {
                const history = new redis_1.RedisChatMessageHistory({ sessionId, client: redisUrl });
                await history.clear();
                console.log(`🧹 Cleared Redis memory for session ${sessionId}`);
            }
            const { clearChatMemory } = await Promise.resolve().then(() => __importStar(require('../agents/toolRegistry')));
            clearChatMemory(sessionId);
            console.log(`🧹 Cleared memory tool for session ${sessionId}`);
        }
        catch (error) {
            console.error(`Failed to clear memory for session ${sessionId}:`, error);
        }
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 10;
    }
    shouldUseRedisMemory(messageCount) {
        return true;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0;
    }
    async *chat(sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature = 0.7, maxTokens = 4000) {
        try {
            const llm = (0, llmFactory_1.getLLM)(modelId, true, temperature, maxTokens);
            const tools = (0, toolRegistry_1.getToolsForSession)(sessionId);
            const defaultSystemPrompt = ("You are a helpful assistant. You have access to a number of tools and must use them when appropriate. " +
                "Always focus on answering the current user's question. Use chat history as context to provide better responses, " +
                "but do not repeat or respond to previous questions in the history.");
            const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
            const prompt = (0, promptFactory_1.buildPrompt)(finalSystemPrompt);
            const agentExecutor = (0, agentFactory_1.createAgent)(llm, tools, prompt);
            const redisUrl = process.env.REDIS_URL;
            if (!redisUrl) {
                throw new Error("REDIS_URL must be configured for chat history support.");
            }
            let redisClient = undefined;
            if (redisUrl) {
                redisClient = (0, redis_2.createClient)({ url: redisUrl });
                await redisClient.connect();
            }
            const createRedisHistory = (sessionId) => {
                if (!redisClient)
                    throw new Error('Redis client not initialized');
                return new redis_1.RedisChatMessageHistory({ sessionId, client: redisClient });
            };
            let agentWithHistory;
            try {
                const chatHistory = await chat_1.ChatModel.findById(sessionId);
                const messageCount = chatHistory?.messages?.length || 0;
                let redisMemoryExists = false;
                try {
                    const history = new redis_1.RedisChatMessageHistory({ sessionId, client: redisClient });
                    const messages = await history.getMessages();
                    redisMemoryExists = messages.length > 0;
                    console.log(`🔍 Redis memory check: ${messages.length} messages found`);
                }
                catch (error) {
                    console.log(`⚠️ Redis memory check failed: ${error}`);
                }
                agentWithHistory = new runnables_1.RunnableWithMessageHistory({
                    runnable: agentExecutor,
                    getMessageHistory: createRedisHistory,
                    inputMessagesKey: "input",
                    historyMessagesKey: "chat_history",
                });
                if (!redisMemoryExists && chatHistory?.messages) {
                    console.log(`🔄 Redis memory empty, restoring recent context for session ${sessionId}`);
                    const recentMessages = chatHistory.messages.slice(-10);
                    try {
                        const history = new redis_1.RedisChatMessageHistory({ sessionId, client: redisClient });
                        for (const msg of recentMessages) {
                            if (msg.role === "user") {
                                await history.addUserMessage(msg.content);
                            }
                            else if (msg.role === "assistant") {
                                await history.addAIChatMessage(msg.content);
                            }
                        }
                        console.log(`💾 Restored ${recentMessages.length} messages to Redis memory`);
                    }
                    catch (error) {
                        console.log(`❌ Failed to restore Redis memory: ${error}`);
                    }
                }
                if (this.shouldEmbedMessages(messageCount) && chatHistory?.messages) {
                    console.log(`🔄 Embedding messages for session ${sessionId} (message count: ${messageCount})`);
                    const messagesForMemory = chatHistory.messages.map(msg => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp?.toISOString() || null
                    }));
                    (0, toolRegistry_1.addChatMemory)(sessionId, messagesForMemory);
                    console.log(`📚 Embedded ${messagesForMemory.length} messages to memory tool for session ${sessionId}`);
                }
                if (this.shouldUseMemoryTool(messageCount)) {
                    console.log(`🔍 Memory tool available for session ${sessionId} (${messageCount} messages)`);
                }
                else {
                    console.log(`💾 Using Redis memory only for session ${sessionId} (${messageCount} messages)`);
                }
            }
            catch (error) {
                console.log(`⚠️ Failed to setup smart memory management: ${error}`);
                agentWithHistory = new runnables_1.RunnableWithMessageHistory({
                    runnable: agentExecutor,
                    getMessageHistory: createRedisHistory,
                    inputMessagesKey: "input",
                    historyMessagesKey: "chat_history",
                });
            }
            const extractOutput = (res) => {
                if (typeof res === 'object' && res.output) {
                    return res.output;
                }
                return res;
            };
            const finalRunnable = agentWithHistory
                .pipe(extractOutput)
                .pipe(new output_parsers_1.StringOutputParser());
            const agentInput = { input: message };
            const config = {
                configurable: { sessionId },
                version: "v1"
            };
            let inputTokens = 0;
            let outputTokens = 0;
            let contentReceived = false;
            let fallbackText = "";
            for await (const event of finalRunnable.streamEvents(agentInput, config)) {
                const kind = event.event;
                console.log(`Event received: ${kind}`);
                if (kind === "on_chat_model_stream") {
                    const chunk = event.data?.chunk;
                    let chunkText = null;
                    if (chunk) {
                        if (typeof chunk === 'object' && 'output' in chunk && 'messages' in chunk) {
                            chunkText = null;
                        }
                        else if (chunk.content) {
                            chunkText = chunk.content;
                        }
                        else if (typeof chunk === 'object') {
                            if (chunk.content && typeof chunk.content === 'string') {
                                chunkText = chunk.content;
                            }
                            else if (chunk.text && typeof chunk.text === 'string') {
                                chunkText = chunk.text;
                            }
                        }
                    }
                    if (chunkText) {
                        contentReceived = true;
                        yield JSON.stringify({ type: "chunk", data: chunkText });
                    }
                }
                else if (kind === "on_tool_start") {
                    const toolData = event.data;
                    const toolName = toolData?.name || "Unknown Tool";
                    const toolInput = toolData?.input || "";
                    console.log(`🔧 Tool started: ${toolName}`);
                    console.log(`🔧 Tool data:`, toolData);
                    yield JSON.stringify({
                        type: "tool_start",
                        data: {
                            tool_name: toolName,
                            tool_input: toolInput
                        }
                    });
                }
                else if (kind === "on_tool_end") {
                    const toolData = event.data;
                    const toolName = toolData?.name || "Unknown Tool";
                    const toolOutput = toolData?.output;
                    console.log(`✅ Tool completed: ${toolName}`);
                    if (toolOutput) {
                        contentReceived = true;
                        yield JSON.stringify({
                            type: "tool_result",
                            data: {
                                tool_name: toolName,
                                output: String(toolOutput)
                            }
                        });
                    }
                }
                else if (kind === "on_tool_error") {
                    const toolData = event.data;
                    const toolName = toolData?.name || "Unknown Tool";
                    const error = toolData?.error || "Unknown error";
                    console.error(`❌ Tool error: ${toolName} - ${error}`);
                    yield JSON.stringify({
                        type: "tool_error",
                        data: {
                            tool_name: toolName,
                            error: String(error)
                        }
                    });
                }
                else if (kind === "on_chain_end") {
                    const finalOutput = event.data?.output;
                    if (typeof finalOutput === 'object') {
                        const usage = finalOutput.usage || {};
                        const contentPiece = finalOutput.output || finalOutput;
                        inputTokens = usage.input_tokens || 0;
                        outputTokens = usage.output_tokens || 0;
                        if (Array.isArray(contentPiece)) {
                            for (const msg of contentPiece.reverse()) {
                                if (msg instanceof messages_1.AIMessage && msg.content) {
                                    fallbackText = typeof msg.content === 'string' ? msg.content : String(msg.content);
                                    break;
                                }
                            }
                            if (!fallbackText) {
                                fallbackText = contentPiece
                                    .map(m => {
                                    const content = m.content;
                                    return typeof content === 'string' ? content : String(content);
                                })
                                    .join('\n');
                            }
                        }
                        else if (contentPiece?.content) {
                            const content = contentPiece.content;
                            fallbackText = typeof content === 'string' ? content : String(content);
                        }
                        else {
                            fallbackText = String(contentPiece);
                        }
                    }
                }
            }
            if (!contentReceived && fallbackText) {
                yield JSON.stringify({ type: "chunk", data: fallbackText });
                contentReceived = true;
            }
            if (inputTokens > 0 || outputTokens > 0) {
                await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
            }
            yield JSON.stringify({
                type: "end",
                data: { inputTokens, outputTokens }
            });
        }
        catch (error) {
            console.error("Error during LangChain agent chat:", error);
            const errorMessage = JSON.stringify({
                type: "error",
                data: `An unexpected error occurred: ${error}`
            });
            yield errorMessage;
        }
        finally {
            if (redisClient) {
                await redisClient.disconnect();
            }
        }
    }
}
exports.LangChainChatService = LangChainChatService;
exports.langchainChatService = new LangChainChatService();
//# sourceMappingURL=langchainChatService.js.map