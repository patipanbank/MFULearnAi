import { ToolExecution, StreamingEventType } from '../types';
interface ToolExecutionContext {
    conversationId: string;
    memory: any;
    config: any;
}
export declare class ConversationToolManager {
    private readonly TOOL_TIMEOUT;
    private readonly MAX_CONCURRENT_TOOLS;
    constructor();
    shouldUseTools(userMessage: string, enabledTools: string[], memoryContext: string): Promise<boolean>;
    executeTools(userMessage: string, enabledTools: string[], context: ToolExecutionContext, onEvent: (event: {
        type: StreamingEventType;
        data: any;
    }) => void): Promise<ToolExecution[]>;
    private selectToolsToExecute;
    private shouldExecuteTool;
    private executeTool;
    private getToolFunction;
    private prepareToolInput;
    private extractSearchQuery;
    private extractMathExpression;
    private createTimeoutPromise;
    private generateExecutionId;
    formatToolResultsForLLM(executions: ToolExecution[]): string;
    private formatToolOutput;
    private formatWebSearchOutput;
    cleanup(): void;
}
export {};
//# sourceMappingURL=ToolManager.d.ts.map