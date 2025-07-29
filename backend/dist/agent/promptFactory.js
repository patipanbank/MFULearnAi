"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptFactory = void 0;
const prompts_1 = require("langchain/prompts");
const schema_1 = require("langchain/schema");
class PromptFactory {
    constructor(config) {
        this.config = config;
    }
    createChatPrompt() {
        const messages = [];
        messages.push(["system", this.config.systemPrompt]);
        if (this.config.includeHistory) {
            messages.push(new prompts_1.MessagesPlaceholder("chat_history"));
        }
        if (this.config.includeContext) {
            messages.push(["system", "Context: {context}"]);
        }
        messages.push(["human", "{input}"]);
        if (this.config.includeTools) {
            messages.push(new prompts_1.MessagesPlaceholder("agent_scratchpad"));
        }
        return prompts_1.ChatPromptTemplate.fromMessages(messages);
    }
    createAgentPrompt() {
        return prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new prompts_1.MessagesPlaceholder("agent_scratchpad"),
        ]);
    }
    createRAGPrompt() {
        return prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            ["system", "Use the following context to answer the question:\n{context}"],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
        ]);
    }
    createToolPrompt() {
        return prompts_1.ChatPromptTemplate.fromMessages([
            ["system", this.config.systemPrompt],
            ["system", "Available tools: {tools}"],
            new prompts_1.MessagesPlaceholder("chat_history"),
            ["human", "{input}"],
            new prompts_1.MessagesPlaceholder("agent_scratchpad"),
        ]);
    }
    createSimplePrompt() {
        return prompts_1.PromptTemplate.fromTemplate(`${this.config.systemPrompt}\n\nQuestion: {input}\nAnswer:`);
    }
    formatChatHistory(messages) {
        if (!this.config.includeHistory) {
            return [];
        }
        const formattedMessages = messages
            .slice(-this.config.maxHistoryLength)
            .map(msg => {
            if (msg.role === 'user') {
                return new schema_1.HumanMessage(msg.content);
            }
            else if (msg.role === 'assistant') {
                return new schema_1.AIMessage(msg.content);
            }
            else if (msg.role === 'system') {
                return new schema_1.SystemMessage(msg.content);
            }
            return msg;
        });
        return formattedMessages;
    }
    formatContext(context) {
        if (!this.config.includeContext || !context.length) {
            return '';
        }
        return context.join('\n\n');
    }
    formatTools(tools) {
        if (!this.config.includeTools || !tools.length) {
            return '';
        }
        return tools.map(tool => `${tool.name}: ${tool.description}`).join('\n');
    }
    static getDefaultSystemPrompt() {
        return `You are a helpful AI assistant. You can help users with various tasks including:
- Answering questions
- Providing information
- Helping with calculations
- Searching for information
- Analyzing data

Please be helpful, accurate, and concise in your responses.`;
    }
    static getAgentSystemPrompt() {
        return `You are an AI agent with access to various tools. You can:
- Use tools to perform tasks
- Search for information
- Make calculations
- Access knowledge bases
- Remember conversation context

When you need to use a tool, do so appropriately. Always explain what you're doing and provide helpful responses.`;
    }
    static getRAGSystemPrompt() {
        return `You are an AI assistant with access to a knowledge base. You can:
- Search through documents and information
- Provide accurate answers based on available knowledge
- Cite sources when appropriate
- Ask for clarification when needed

Use the provided context to answer questions accurately and comprehensively.`;
    }
}
exports.PromptFactory = PromptFactory;
//# sourceMappingURL=promptFactory.js.map