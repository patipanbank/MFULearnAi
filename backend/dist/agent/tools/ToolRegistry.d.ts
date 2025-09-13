export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;
export interface ToolMeta {
    name: string;
    description: string;
    func: ToolFunction;
}
export declare class ToolRegistry {
    private staticTools;
    constructor();
    private initializeStaticTools;
    getStaticTools(): {
        [name: string]: ToolFunction;
    };
    createMemoryTools(sessionId: string): {
        [name: string]: ToolFunction;
    };
    createRetrievalTools(collectionNames: string[]): {
        [name: string]: ToolFunction;
    };
    getAllToolsForSession(sessionId: string, collectionNames?: string[]): {
        [name: string]: ToolFunction;
    };
    getAvailableTools(): string[];
    getToolDescription(toolName: string): string | null;
}
export declare const toolRegistry: ToolRegistry;
export declare const createMemoryTool: (sessionId: string) => {
    [name: string]: ToolFunction;
};
export declare const createRetrievalTools: (collectionNames: string[]) => {
    [name: string]: ToolFunction;
};
//# sourceMappingURL=ToolRegistry.d.ts.map