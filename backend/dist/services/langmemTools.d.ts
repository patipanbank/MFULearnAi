import { ConversationContext } from './langmemService';
import { ToolFunction } from './toolRegistry';
export interface LangMemToolConfig {
    sessionId: string;
    userId?: string;
    agentId?: string;
    namespace?: string;
}
export declare class LangMemTools {
    static createMemoryTools(config: LangMemToolConfig): {
        [name: string]: ToolFunction;
    };
    static createManageMemoryTool(context: ConversationContext): ToolFunction;
    static createSearchMemoryTool(context: ConversationContext): ToolFunction;
    static createAddMemoryTool(context: ConversationContext): ToolFunction;
    static createGetContextTool(context: ConversationContext): ToolFunction;
    static createClearMemoryTool(context: ConversationContext): ToolFunction;
    static createMemoryStatsTool(context: ConversationContext): ToolFunction;
    static createLegacyMemoryTools(sessionId: string): {
        [name: string]: ToolFunction;
    };
}
export declare const createLangMemTools: (config: LangMemToolConfig) => {
    [name: string]: ToolFunction;
};
export declare const createLegacyLangMemTools: (sessionId: string) => {
    [name: string]: ToolFunction;
};
//# sourceMappingURL=langmemTools.d.ts.map