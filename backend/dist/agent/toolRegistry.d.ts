export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;
export interface ToolMeta {
    name: string;
    description: string;
    func: ToolFunction;
}
export declare const toolRegistry: Record<string, ToolMeta>;
export declare function createMemoryTool(sessionId: string): {
    [x: string]: {
        name: string;
        description: string;
        func: (input: string) => Promise<string>;
    };
};
export declare function addChatMemory(sessionId: string, messages: {
    role: string;
    content: string;
    id?: string;
    timestamp?: string;
}[]): Promise<void>;
export declare function clearChatMemory(sessionId: string): Promise<void>;
export declare function getMemoryStats(sessionId: string): Promise<string>;
//# sourceMappingURL=toolRegistry.d.ts.map