import { ChatPromptTemplate } from "@langchain/core/prompts";
import { PromptTemplate } from "@langchain/core/prompts";
export interface PromptConfig {
    systemPrompt: string;
    includeHistory: boolean;
    includeTools: boolean;
    includeContext: boolean;
    maxHistoryLength: number;
}
export declare class PromptFactory {
    private config;
    constructor(config: PromptConfig);
    createChatPrompt(): ChatPromptTemplate;
    createAgentPrompt(): ChatPromptTemplate;
    createRAGPrompt(): ChatPromptTemplate;
    createToolPrompt(): ChatPromptTemplate;
    createSimplePrompt(): PromptTemplate;
    formatChatHistory(messages: any[]): any[];
    formatContext(context: string[]): string;
    formatTools(tools: any[]): string;
    static getDefaultSystemPrompt(): string;
    static getAgentSystemPrompt(): string;
    static getRAGSystemPrompt(): string;
}
//# sourceMappingURL=promptFactory.d.ts.map