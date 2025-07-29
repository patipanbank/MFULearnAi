import { ChatMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
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
    processMessage(messages: (ChatMessage | HumanMessage | AIMessage)[], onEvent?: (event: {
        type: string;
        data?: any;
    }) => void): Promise<string>;
    private formatChatHistory;
    addToMemory(content: string, metadata?: any): Promise<void>;
    searchMemory(query: string, k?: number): Promise<any[]>;
    getTools(): DynamicTool[];
}
//# sourceMappingURL=langchainAgent.d.ts.map