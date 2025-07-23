import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
export interface AgentExecutor {
    run: (messages: {
        role: string;
        content: string;
    }[]) => Promise<string>;
}
export declare function createAgent(llm: LLM, tools: {
    [name: string]: ToolFunction;
}, prompt: string): AgentExecutor;
//# sourceMappingURL=agentFactory.d.ts.map