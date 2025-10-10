import { ToolFunction } from '../services/toolRegistry';
export interface LangChainAgentConfig {
    modelId: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    tools: {
        [name: string]: ToolFunction;
    };
    sessionId?: string;
}
export interface LangChainAgentExecutor {
    run: (messages: {
        role: string;
        content: string;
    }[], options?: {
        onEvent?: (event: {
            type: string;
            data?: any;
        }) => void;
        maxSteps?: number;
    }) => Promise<string>;
}
/**
 * สร้าง LangChain Agent ที่ใช้ LangChain Agent framework เต็มรูปแบบ
 * - เพิ่ม hybrid memory management (Redis + Vectorstore)
 * - รองรับ streaming events แบบ legacy
 * - แก้ไขการเรียกใช้ tool จริงๆ
 */
export declare function createLangChainAgent(config: LangChainAgentConfig): Promise<LangChainAgentExecutor>;
//# sourceMappingURL=langchainAgentFactory.d.ts.map