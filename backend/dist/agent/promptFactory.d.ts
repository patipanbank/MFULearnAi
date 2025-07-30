import { PromptTemplate } from '@langchain/core/prompts';
import { ChatPromptTemplate } from '@langchain/core/prompts';
export declare function createPromptTemplate(systemPrompt: string, useHistory?: boolean): (messages: {
    role: string;
    content: string;
}[], scratchpad?: string[]) => string;
export declare function createLangChainPromptTemplate(systemPrompt: string, useHistory?: boolean): PromptTemplate;
export declare function createAgentPromptTemplate(systemPrompt: string): PromptTemplate;
export declare function createLegacySystemPrompt(basePrompt?: string): string;
export declare function createLegacyChatPromptTemplate(systemPrompt?: string): ChatPromptTemplate;
//# sourceMappingURL=promptFactory.d.ts.map