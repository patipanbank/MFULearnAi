"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationLLMManager = void 0;
const prompts_1 = require("@langchain/core/prompts");
const types_1 = require("../types");
const llmFactory_1 = require("../../agent/llmFactory");
class ConversationLLMManager {
    constructor() {
        this.DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Use the provided tools when appropriate to answer questions accurately.

If you have tool results available, incorporate them naturally into your response. Always be helpful, accurate, and conversational.

Memory context:
{memory_context}

Tool results:
{tool_results}`;
        console.log('🤖 ConversationLLMManager initialized');
    }
    async generateResponse(context, onChunk) {
        console.log(`🤖 Generating response for conversation ${context.currentMessage.conversationId}`);
        try {
            const prompt = await this.preparePrompt(context);
            const llm = (0, llmFactory_1.getLLM)(context.config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
                temperature: context.config.temperature || 0.7,
                maxTokens: context.config.maxTokens || 4000,
                streaming: true,
                systemPrompt: context.config.systemPrompt || this.DEFAULT_SYSTEM_PROMPT
            });
            const formattedPrompt = this.DEFAULT_SYSTEM_PROMPT
                .replace('{memory_context}', context.memory.context)
                .replace('{tool_results}', this.formatToolResults(context.toolOutput))
                + '\n\nUser: ' + context.currentMessage.content + '\n\nAssistant:';
            let fullContent = '';
            let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
            const stream = llm.stream(formattedPrompt);
            for await (const chunkContent of stream) {
                if (chunkContent) {
                    fullContent += chunkContent;
                    onChunk(chunkContent);
                }
            }
            tokenUsage = {
                promptTokens: this.estimateTokenUsage(formattedPrompt),
                completionTokens: this.estimateTokenUsage(fullContent),
                totalTokens: this.estimateTokenUsage(formattedPrompt + fullContent)
            };
            return {
                content: fullContent,
                tokenUsage,
                finishReason: 'stop'
            };
        }
        catch (error) {
            console.error('❌ LLM generation failed:', error);
            throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async preparePrompt(context) {
        const systemPrompt = context.config.systemPrompt || this.DEFAULT_SYSTEM_PROMPT;
        const conversationMessages = this.buildConversationHistory(context.messages);
        const promptTemplate = prompts_1.ChatPromptTemplate.fromMessages([
            ['system', systemPrompt],
            ...conversationMessages,
            ['human', '{user_message}']
        ]);
        return promptTemplate;
    }
    buildConversationHistory(messages) {
        const history = [];
        const recentMessages = messages.slice(-10);
        recentMessages.forEach(message => {
            const role = this.mapMessageRoleToPromptRole(message.role);
            if (role) {
                let content = message.content;
                if (message.toolCalls && message.toolCalls.length > 0) {
                    const toolInfo = message.toolCalls
                        .filter(tc => tc.status === 'completed')
                        .map(tc => `Used ${tc.name}: ${tc.output}`)
                        .join('\n');
                    if (toolInfo) {
                        content += `\n\n[Tools used: ${toolInfo}]`;
                    }
                }
                history.push([role, content]);
            }
        });
        return history;
    }
    mapMessageRoleToPromptRole(role) {
        switch (role) {
            case types_1.MessageRole.USER:
                return 'human';
            case types_1.MessageRole.ASSISTANT:
                return 'assistant';
            case types_1.MessageRole.SYSTEM:
                return 'system';
            default:
                return null;
        }
    }
    formatToolResults(toolOutput) {
        if (!toolOutput) {
            return 'No tools were used for this response.';
        }
        if (Array.isArray(toolOutput)) {
            return toolOutput
                .filter(execution => execution.status === 'completed')
                .map(execution => {
                return `${execution.toolName}: ${this.formatSingleToolResult(execution.output)}`;
            })
                .join('\n\n');
        }
        return this.formatSingleToolResult(toolOutput);
    }
    formatSingleToolResult(output) {
        if (typeof output === 'string') {
            return output;
        }
        if (typeof output === 'object') {
            if (output.results && Array.isArray(output.results)) {
                return output.results
                    .slice(0, 3)
                    .map((result) => `- ${result.title || result.name}: ${result.snippet || result.description}`)
                    .join('\n');
            }
            if (output.result !== undefined) {
                return String(output.result);
            }
            if (output.documents && Array.isArray(output.documents)) {
                return output.documents
                    .slice(0, 3)
                    .map((doc) => `- ${doc.title || 'Document'}: ${doc.content?.substring(0, 200)}...`)
                    .join('\n');
            }
            return JSON.stringify(output, null, 2);
        }
        return String(output);
    }
    validateAndEnhanceResponse(response, context) {
        let enhancedResponse = response;
        enhancedResponse = enhancedResponse.trim().replace(/\n{3,}/g, '\n\n');
        if (!enhancedResponse) {
            enhancedResponse = 'I apologize, but I couldn\'t generate a proper response. Please try rephrasing your question.';
        }
        if (enhancedResponse.length < 50 && context.toolOutput) {
            enhancedResponse += '\n\nI used the available tools to gather information for this response.';
        }
        return enhancedResponse;
    }
    getModelCapabilities(modelId) {
        const capabilities = {
            'anthropic.claude-3-5-sonnet-20240620-v1:0': {
                supportsVision: true,
                supportsStreaming: true,
                maxTokens: 200000,
                supportedTools: ['web_search', 'calculator', 'current_date', 'memory_search']
            },
            'anthropic.claude-3-haiku-20240307-v1:0': {
                supportsVision: true,
                supportsStreaming: true,
                maxTokens: 200000,
                supportedTools: ['web_search', 'calculator', 'current_date']
            }
        };
        return capabilities[modelId] || {
            supportsVision: false,
            supportsStreaming: true,
            maxTokens: 4000,
            supportedTools: ['calculator', 'current_date']
        };
    }
    estimateTokenUsage(content) {
        return Math.ceil(content.length / 4);
    }
    handleLLMError(error, context) {
        console.error('❌ LLM Error:', error);
        if (error.message?.includes('token')) {
            return 'I apologize, but your message is too long. Please try breaking it into smaller parts.';
        }
        if (error.message?.includes('rate limit')) {
            return 'I\'m currently experiencing high demand. Please try again in a moment.';
        }
        if (error.message?.includes('content policy')) {
            return 'I can\'t provide a response to that request. Please try rephrasing your question.';
        }
        return 'I apologize, but I encountered an error while processing your request. Please try again.';
    }
    cleanup() {
        console.log('🧹 ConversationLLMManager cleaned up');
    }
}
exports.ConversationLLMManager = ConversationLLMManager;
//# sourceMappingURL=LLMManager.js.map