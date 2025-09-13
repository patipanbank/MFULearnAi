import type { LLM } from '../llmFactory';
import type { ToolFunction } from '../tools/ToolRegistry';
import { AgentExecutor } from './AgentExecutor';
import type { AgentConfig } from './types/agent.types';
export declare class AgentFactory {
    private cache;
    constructor();
    createAgent(llm: LLM, tools: {
        [name: string]: ToolFunction;
    }, prompt: string, config?: AgentConfig): Promise<AgentExecutor>;
    clearSessionCache(sessionId: string): void;
    clearAllCache(): void;
    getCacheStats(): import("./types/agent.types").AgentStats;
}
export declare const agentFactory: AgentFactory;
//# sourceMappingURL=AgentFactory.d.ts.map