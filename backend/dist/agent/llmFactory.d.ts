import { ChatMessage } from "langchain/schema";
export interface LLMOptions {
    region?: string;
    model?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
}
export declare class LLM {
    private chat;
    private options;
    constructor(options: LLMOptions);
    generate(messages: ChatMessage[]): Promise<string>;
}
export declare function getLLM(options: LLMOptions): LLM;
//# sourceMappingURL=llmFactory.d.ts.map