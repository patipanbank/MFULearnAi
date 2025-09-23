"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const types_1 = require("../types");
const MemoryManager_1 = require("./MemoryManager");
const ToolManager_1 = require("./ToolManager");
const LLMManager_1 = require("./LLMManager");
const events_1 = require("events");
class ConversationGraph extends events_1.EventEmitter {
    constructor() {
        super();
        this.memoryManager = new MemoryManager_1.ConversationMemoryManager();
        this.toolManager = new ToolManager_1.ConversationToolManager();
        this.llmManager = new LLMManager_1.ConversationLLMManager();
        this.graph = this.createWorkflowGraph();
    }
    createWorkflowGraph() {
        const workflow = new langgraph_1.StateGraph({
            channels: {
                conversationId: { value: (x, y) => y ?? x },
                messages: { value: (x, y) => [...(x || []), ...(y || [])] },
                currentMessage: { value: (x, y) => y ?? x },
                memory: { value: (x, y) => ({ ...x, ...y }) },
                tools: { value: (x, y) => ({ ...x, ...y }) },
                config: { value: (x, y) => ({ ...x, ...y }) },
                metadata: { value: (x, y) => ({ ...x, ...y }) },
                currentStep: { value: (x, y) => y ?? x },
                shouldContinue: { value: (x, y) => y ?? x },
                toolOutput: { value: (x, y) => y ?? x },
                memoryUpdated: { value: (x, y) => y ?? x },
                streamingActive: { value: (x, y) => y ?? x }
            }
        });
        workflow.addNode('memory_load', this.memoryLoadNode.bind(this));
        workflow.addNode('tool_routing', this.toolRoutingNode.bind(this));
        workflow.addNode('tool_execution', this.toolExecutionNode.bind(this));
        workflow.addNode('llm_generation', this.llmGenerationNode.bind(this));
        workflow.addNode('memory_update', this.memoryUpdateNode.bind(this));
        workflow.addNode('response_finalization', this.responseFinalizationNode.bind(this));
        workflow.addEdge(langgraph_1.START, 'memory_load');
        workflow.addEdge('memory_load', 'tool_routing');
        try {
            workflow.addConditionalEdges('tool_routing', this.shouldExecuteTools.bind(this), {
                'execute_tools': 'tool_execution',
                'skip_tools': 'llm_generation'
            });
        }
        catch (error) {
            console.warn('LangGraph conditional edges not supported, using simple edges');
            workflow.addEdge('tool_routing', 'llm_generation');
        }
        workflow.addEdge('tool_execution', 'llm_generation');
        workflow.addEdge('llm_generation', 'memory_update');
        workflow.addEdge('memory_update', 'response_finalization');
        workflow.addEdge('response_finalization', langgraph_1.END);
        try {
            return workflow.compile();
        }
        catch (error) {
            console.warn('LangGraph compilation failed:', error);
            return workflow;
        }
    }
    async memoryLoadNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'memory_load',
            conversationId: state.conversationId
        });
        try {
            const memoryContext = await this.memoryManager.loadMemory(state.conversationId, state.config.memorySettings);
            return {
                memory: memoryContext,
                currentStep: 'memory_load',
                metadata: {
                    ...state.metadata,
                    nodeHistory: [...state.metadata.nodeHistory, 'memory_load']
                }
            };
        }
        catch (error) {
            this.emitEvent(types_1.StreamingEventType.WORKFLOW_ERROR, {
                step: 'memory_load',
                error: error instanceof Error ? error.message : 'Memory load failed',
                conversationId: state.conversationId
            });
            throw error;
        }
    }
    async toolRoutingNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'tool_routing',
            conversationId: state.conversationId
        });
        const userMessage = state.currentMessage;
        if (!userMessage || userMessage.role !== types_1.MessageRole.USER) {
            return {
                currentStep: 'tool_routing',
                shouldContinue: false
            };
        }
        const shouldUseTools = await this.toolManager.shouldUseTools(userMessage.content, state.config.enabledTools, state.memory.context);
        return {
            currentStep: 'tool_routing',
            shouldContinue: shouldUseTools,
            metadata: {
                ...state.metadata,
                nodeHistory: [...state.metadata.nodeHistory, 'tool_routing']
            }
        };
    }
    async toolExecutionNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'tool_execution',
            conversationId: state.conversationId
        });
        if (!state.currentMessage) {
            throw new Error('No current message for tool execution');
        }
        try {
            const toolResults = await this.toolManager.executeTools(state.currentMessage.content, state.config.enabledTools, {
                conversationId: state.conversationId,
                memory: state.memory,
                config: state.config
            }, (event) => this.emitEvent(event.type, event.data));
            return {
                toolOutput: toolResults,
                currentStep: 'tool_execution',
                tools: {
                    ...state.tools,
                    executionHistory: [...state.tools.executionHistory, ...toolResults]
                },
                metadata: {
                    ...state.metadata,
                    nodeHistory: [...state.metadata.nodeHistory, 'tool_execution']
                }
            };
        }
        catch (error) {
            this.emitEvent(types_1.StreamingEventType.WORKFLOW_ERROR, {
                step: 'tool_execution',
                error: error instanceof Error ? error.message : 'Tool execution failed',
                conversationId: state.conversationId
            });
            throw error;
        }
    }
    async llmGenerationNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'llm_generation',
            conversationId: state.conversationId
        });
        if (!state.currentMessage) {
            throw new Error('No current message for LLM generation');
        }
        try {
            this.emitEvent(types_1.StreamingEventType.MESSAGE_STARTED, {
                conversationId: state.conversationId,
                messageId: state.currentMessage.id
            });
            const response = await this.llmManager.generateResponse({
                messages: state.messages,
                currentMessage: state.currentMessage,
                memory: state.memory,
                toolOutput: state.toolOutput,
                config: state.config
            }, (chunk) => {
                this.emitEvent(types_1.StreamingEventType.MESSAGE_CHUNK, {
                    conversationId: state.conversationId,
                    messageId: state.currentMessage.id,
                    chunk,
                    isStreaming: true
                });
            });
            return {
                currentStep: 'llm_generation',
                streamingActive: false,
                metadata: {
                    ...state.metadata,
                    totalTokens: state.metadata.totalTokens + (response.tokenUsage?.totalTokens || 0),
                    nodeHistory: [...state.metadata.nodeHistory, 'llm_generation']
                }
            };
        }
        catch (error) {
            this.emitEvent(types_1.StreamingEventType.MESSAGE_FAILED, {
                conversationId: state.conversationId,
                messageId: state.currentMessage.id,
                error: error instanceof Error ? error.message : 'LLM generation failed'
            });
            throw error;
        }
    }
    async memoryUpdateNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'memory_update',
            conversationId: state.conversationId
        });
        try {
            await this.memoryManager.updateMemory(state.conversationId, state.messages, state.config.memorySettings);
            return {
                currentStep: 'memory_update',
                memoryUpdated: true,
                metadata: {
                    ...state.metadata,
                    nodeHistory: [...state.metadata.nodeHistory, 'memory_update']
                }
            };
        }
        catch (error) {
            this.emitEvent(types_1.StreamingEventType.WORKFLOW_ERROR, {
                step: 'memory_update',
                error: error instanceof Error ? error.message : 'Memory update failed',
                conversationId: state.conversationId
            });
            return {
                currentStep: 'memory_update',
                memoryUpdated: false
            };
        }
    }
    async responseFinalizationNode(state) {
        this.emitEvent(types_1.StreamingEventType.WORKFLOW_STEP, {
            step: 'response_finalization',
            conversationId: state.conversationId
        });
        if (state.currentMessage) {
            this.emitEvent(types_1.StreamingEventType.MESSAGE_COMPLETED, {
                conversationId: state.conversationId,
                messageId: state.currentMessage.id
            });
        }
        return {
            currentStep: 'response_finalization',
            metadata: {
                ...state.metadata,
                stepCount: state.metadata.nodeHistory.length,
                lastStepTime: new Date(),
                nodeHistory: [...state.metadata.nodeHistory, 'response_finalization']
            }
        };
    }
    shouldExecuteTools(state) {
        return state.shouldContinue ? 'execute_tools' : 'skip_tools';
    }
    async runConversation(conversationId, message, config) {
        const initialState = {
            conversationId,
            messages: [],
            currentMessage: message,
            memory: {
                shortTerm: [],
                longTerm: [],
                context: '',
                embeddings: [],
                lastUpdate: new Date()
            },
            tools: {
                availableTools: config.enabledTools || [],
                executionHistory: [],
                currentExecution: undefined
            },
            config,
            metadata: {
                stepCount: 0,
                startTime: new Date(),
                lastStepTime: new Date(),
                totalTokens: 0,
                errors: [],
                nodeHistory: []
            },
            currentStep: 'start',
            shouldContinue: false,
            memoryUpdated: false,
            streamingActive: true
        };
        try {
            if (typeof this.workflow.invoke === 'function') {
                const result = await this.workflow.invoke(initialState);
                return result;
            }
            else {
                console.warn('LangGraph invoke not available, using fallback execution');
                const result = await this.executeWorkflowFallback(initialState);
                return result;
            }
        }
        catch (error) {
            this.emitEvent(types_1.StreamingEventType.ERROR, {
                conversationId,
                error: error instanceof Error ? error.message : 'Workflow execution failed'
            });
            throw error;
        }
    }
    emitEvent(type, data) {
        const event = {
            type,
            conversationId: data.conversationId,
            messageId: data.messageId,
            data,
            timestamp: new Date()
        };
        console.log(`📡 Workflow Event: ${type}`, data);
        this.emit('workflow_event', event);
    }
    async executeWorkflowFallback(state) {
        console.log('🔄 Executing workflow fallback');
        let currentState = state;
        try {
            currentState = await this.memoryLoadNode(currentState);
            currentState = await this.toolRoutingNode(currentState);
            if (currentState.shouldContinue && currentState.context.toolExecutions.length > 0) {
                currentState = await this.toolExecutionNode(currentState);
            }
            currentState = await this.llmGenerationNode(currentState);
            currentState = await this.memoryUpdateNode(currentState);
            currentState = await this.responseFinalizationNode(currentState);
            return currentState;
        }
        catch (error) {
            console.error('❌ Fallback execution failed:', error);
            throw error;
        }
    }
    cleanup() {
        this.memoryManager.cleanup();
        this.toolManager.cleanup();
        this.llmManager.cleanup();
        this.removeAllListeners();
    }
}
exports.ConversationGraph = ConversationGraph;
//# sourceMappingURL=ConversationGraph.js.map