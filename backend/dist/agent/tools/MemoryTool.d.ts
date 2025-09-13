import type { ToolFunction } from './ToolRegistry';
export declare class MemoryTool {
    private sessionId;
    constructor(sessionId: string);
    getTools(): {
        [name: string]: ToolFunction;
    };
    private createStoreFunction;
    private createSearchFunction;
    private createListFunction;
}
//# sourceMappingURL=MemoryTool.d.ts.map