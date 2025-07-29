import { ChatMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
export interface StreamingAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    tools: string[];
    collectionNames: string[];
    sessionId: string;
}
export declare class StreamingAgent {
    private config;
    private llm;
    private tools;
    private memoryStore;
    private agentExecutor;
    constructor(config: StreamingAgentConfig);
    initialize(): Promise<void>;
    private setupTools;
    private createCollectionRetriever;
    private setupMemory;
    private createAgent;
    processMessageStream(messages: (ChatMessage | HumanMessage | AIMessage)[], onEvent: (event: {
        type: string;
        data?: any;
    }) => void): Promise<void>;
    private formatChatHistory;
    addToMemory(content: string, metadata?: any): Promise<void>;
    searchMemory(query: string, k?: number): Promise<any[]>;
    getTools(): DynamicTool[];
}
//# sourceMappingURL=streamingAgent.d.ts.map