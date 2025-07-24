export type ToolFunction = (input: string, sessionId: string, config?: any) => Promise<string>;
export declare const toolRegistry: Record<string, ToolFunction>;
//# sourceMappingURL=toolRegistry.d.ts.map