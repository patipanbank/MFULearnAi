export interface SimpleLangGraphConfig {
    modelId: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    sessionId?: string;
    userId?: string;
    agentId?: string;
    collectionNames?: string[];
    allowedTools?: string[];
    maxIterations?: number;
}
export interface SimpleLangGraphExecutor {
    run: (messages: {
        role: string;
        content: string;
    }[], options?: {
        onEvent?: (event: {
            type: string;
            data?: any;
        }) => void;
        maxSteps?: number;
        images?: Array<{
            url: string;
            mediaType: string;
            base64Data?: string;
        }>;
    }) => Promise<string>;
    getState: () => any;
    visualize: () => string;
}
export declare function createSimpleLangGraphAgent(config: SimpleLangGraphConfig): Promise<SimpleLangGraphExecutor>;
//# sourceMappingURL=simpleLanggraphAgent.d.ts.map