import { ConversationMessage } from '../types';
import { EventEmitter } from 'events';
export declare class ConversationGraph extends EventEmitter {
    private graph;
    private memoryManager;
    private toolManager;
    private llmManager;
    constructor();
    private createWorkflowGraph;
    private memoryLoadNode;
    private toolRoutingNode;
    private toolExecutionNode;
    private llmGenerationNode;
    private memoryUpdateNode;
    private responseFinalizationNode;
    private shouldExecuteTools;
    runConversation(conversationId: string, message: ConversationMessage, config: any): Promise<any>;
    private emitEvent;
    private executeWorkflowFallback;
    cleanup(): void;
}
//# sourceMappingURL=ConversationGraph.d.ts.map