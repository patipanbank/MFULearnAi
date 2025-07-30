import { PromptTemplate } from '@langchain/core/prompts';
export declare function createPromptTemplate(systemPrompt: string, useHistory?: boolean): (messages: {
    role: string;
    content: string;
}[], scratchpad?: string[]) => string;
export declare function createLangChainPromptTemplate(systemPrompt: string, useHistory?: boolean): PromptTemplate;
export declare function createAgentPromptTemplate(systemPrompt: string): PromptTemplate;
//# sourceMappingURL=promptFactory.d.ts.map