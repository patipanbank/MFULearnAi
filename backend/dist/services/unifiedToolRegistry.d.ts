export type ToolFunction = (input: string, sessionId?: string, config?: any) => Promise<string>;
export interface ToolMeta {
    name: string;
    description: string;
    func: ToolFunction;
    category: 'utility' | 'search' | 'memory' | 'knowledge';
    required_params: string[];
}
export declare function createSessionTools(sessionId: string): Record<string, ToolFunction>;
export declare function createKnowledgeTools(collectionNames: string[]): Record<string, ToolFunction>;
export declare function getAllTools(sessionId: string, collections?: string[]): Record<string, ToolFunction>;
export declare const toolMetadata: Record<string, Omit<ToolMeta, 'func'>>;
export declare const toolRegistry: Record<string, ToolFunction>;
//# sourceMappingURL=unifiedToolRegistry.d.ts.map