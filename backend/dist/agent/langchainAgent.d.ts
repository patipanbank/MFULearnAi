import { ChatMessage } from "langchain/schema";
import { Tool } from "langchain/tools";
export interface LangChainAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    tools: string[];
    collectionNames: string[];
    sessionId: string;
}
export declare class LangChainAgent {
    private config;
    private llm;
    private tools;
    private memoryStore;
    private agentExecutor;
    constructor(config: LangChainAgentConfig);
    initialize(): Promise<void>;
    private setupTools;
    private createCollectionRetriever;
    private setupMemory;
    private createAgent;
    processMessage(messages: ChatMessage[], onEvent?: (event: {
        type: string;
        data?: any;
    }) => void): Promise<string>;
    addToMemory(content: string, metadata?: any): Promise<void>;
    searchMemory(query: string, k?: number): Promise<any[]>;
    getTools(): Tool[];
}
//# sourceMappingURL=langchainAgent.d.ts.map