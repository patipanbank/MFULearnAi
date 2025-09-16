export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;
export interface ToolMeta {
    name: string;
    description: string;
    func: ToolFunction;
}
export declare const toolRegistry: Record<string, ToolMeta>;
export interface WebSearchResult {
    title: string;
    snippet: string;
    url: string;
}
export declare const webSearchTool: ToolMeta;
export declare function createMemoryTool(sessionId: string): {
    [x: string]: {
        name: string;
        description: string;
        func: (input: string) => Promise<string>;
    };
};
export declare function createRetrievalTools(collectionNames: string[]): Record<string, ToolMeta>;
export declare function addChatMemory(sessionId: string, messages: {
    role: string;
    content: string;
    id?: string;
    timestamp?: string;
}[]): Promise<void>;
export declare function clearChatMemory(sessionId: string): Promise<void>;
export declare function getMemoryStats(sessionId: string): Promise<{
    recentCount: number;
    totalCount: number;
    sessionId: string;
    memoryType: string;
    error?: undefined;
} | {
    error: string;
    recentCount?: undefined;
    totalCount?: undefined;
    sessionId?: undefined;
    memoryType?: undefined;
}>;
//# sourceMappingURL=toolRegistry.d.ts.map