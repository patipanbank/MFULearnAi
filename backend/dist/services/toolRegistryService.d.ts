export interface Tool {
    name: string;
    description: string;
    execute: (input: any) => Promise<string>;
}
export declare class ToolRegistryService {
    private tools;
    constructor();
    private initializeDefaultTools;
    registerTool(tool: Tool): void;
    getTool(name: string): Tool | undefined;
    getToolsForSession(sessionId: string): Tool[];
    executeTool(toolName: string, input: any): Promise<string>;
    getAvailableTools(): string[];
    getToolDescriptions(): Record<string, string>;
}
export declare const toolRegistryService: ToolRegistryService;
//# sourceMappingURL=toolRegistryService.d.ts.map