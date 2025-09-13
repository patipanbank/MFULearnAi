import type { LLM } from '../llmFactory';
import type { ToolFunction } from '../tools/ToolRegistry';
import type { AgentConfig, AgentExecutorOptions, AgentMessage } from './types/agent.types';
export declare class AgentExecutor {
    private llm;
    private tools;
    private config;
    private langchainAgent;
    private initialized;
    constructor(llm: LLM, tools: {
        [name: string]: ToolFunction;
    }, config: Required<AgentConfig>);
    initialize(): Promise<void>;
    run(messages: AgentMessage[], options?: AgentExecutorOptions): Promise<string>;
    private shouldUseMultimodal;
    private runMultimodal;
    getConfig(): Required<AgentConfig>;
    isInitialized(): boolean;
    dispose(): void;
}
//# sourceMappingURL=AgentExecutor.d.ts.map