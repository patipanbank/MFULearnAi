import { RunnableSequence } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
export interface ChainConfig {
    modelId: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    chainType: 'simple' | 'rag' | 'conversational' | 'agent';
    collectionNames: string[];
    sessionId: string;
}
export declare class ChainFactory {
    private config;
    private llm;
    private memoryStore;
    constructor(config: ChainConfig);
    initialize(): Promise<void>;
    private setupMemory;
    createSimpleChain(): RunnableSequence;
    createConversationalChain(): RunnableSequence;
    createRAGChain(): RunnableSequence;
    private retrieveContext;
    processMessage(messages: BaseMessage[], onEvent?: (event: {
        type: string;
        data?: any;
    }) => void): Promise<string>;
    private getChain;
    private formatChatHistory;
    addToMemory(content: string, metadata?: any): Promise<void>;
    searchMemory(query: string, k?: number): Promise<any[]>;
}
//# sourceMappingURL=chainFactory.d.ts.map