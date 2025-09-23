/**
 * ConversationGraph - LangGraph Workflow
 *
 * ระบบ workflow สำหรับการจัดการ conversation ด้วย LangGraph
 * รองรับ memory management, tool execution และ streaming responses
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  WorkflowState,
  WorkflowNodeType,
  StreamingEvent,
  StreamingEventType,
  MessageRole,
  MessageStatus,
  ConversationMessage
} from '../types';
import { ConversationMemoryManager } from './MemoryManager';
import { ConversationToolManager } from './ToolManager';
import { ConversationLLMManager } from './LLMManager';
import { EventEmitter } from 'events';

// ============= WORKFLOW STATE MANAGEMENT =============

interface ConversationWorkflowState extends WorkflowState {
  // Add workflow-specific fields
  currentStep: string;
  shouldContinue: boolean;
  toolOutput?: any;
  memoryUpdated: boolean;
  streamingActive: boolean;
}

// ============= CONVERSATION GRAPH CLASS =============

export class ConversationGraph extends EventEmitter {
  private graph: StateGraph<ConversationWorkflowState>;
  private memoryManager: ConversationMemoryManager;
  private toolManager: ConversationToolManager;
  private llmManager: ConversationLLMManager;

  constructor() {
    super();
    this.memoryManager = new ConversationMemoryManager();
    this.toolManager = new ConversationToolManager();
    this.llmManager = new ConversationLLMManager();

    this.graph = this.createWorkflowGraph();
  }

  // ============= GRAPH CREATION =============

  private createWorkflowGraph(): StateGraph<ConversationWorkflowState> {
    const workflow = new StateGraph<ConversationWorkflowState>({
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

    // Define nodes
    workflow.addNode('memory_load', this.memoryLoadNode.bind(this));
    workflow.addNode('tool_routing', this.toolRoutingNode.bind(this));
    workflow.addNode('tool_execution', this.toolExecutionNode.bind(this));
    workflow.addNode('llm_generation', this.llmGenerationNode.bind(this));
    workflow.addNode('memory_update', this.memoryUpdateNode.bind(this));
    workflow.addNode('response_finalization', this.responseFinalizationNode.bind(this));

    // Define edges
    workflow.addEdge(START, 'memory_load');
    workflow.addEdge('memory_load', 'tool_routing');

    // Conditional routing from tool_routing
    workflow.addConditionalEdges(
      'tool_routing',
      this.shouldExecuteTools.bind(this),
      {
        'execute_tools': 'tool_execution',
        'skip_tools': 'llm_generation'
      }
    );

    workflow.addEdge('tool_execution', 'llm_generation');
    workflow.addEdge('llm_generation', 'memory_update');
    workflow.addEdge('memory_update', 'response_finalization');
    workflow.addEdge('response_finalization', END);

    return workflow.compile();
  }

  // ============= WORKFLOW NODES =============

  /**
   * Memory Load Node - โหลดและเตรียม memory context
   */
  private async memoryLoadNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'memory_load',
      conversationId: state.conversationId
    });

    try {
      const memoryContext = await this.memoryManager.loadMemory(
        state.conversationId,
        state.config.memorySettings
      );

      return {
        memory: memoryContext,
        currentStep: 'memory_load',
        metadata: {
          ...state.metadata,
          nodeHistory: [...state.metadata.nodeHistory, 'memory_load']
        }
      };
    } catch (error) {
      this.emitEvent(StreamingEventType.WORKFLOW_ERROR, {
        step: 'memory_load',
        error: error instanceof Error ? error.message : 'Memory load failed',
        conversationId: state.conversationId
      });
      throw error;
    }
  }

  /**
   * Tool Routing Node - ตัดสินใจว่าต้องใช้ tools หรือไม่
   */
  private async toolRoutingNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'tool_routing',
      conversationId: state.conversationId
    });

    const userMessage = state.currentMessage;
    if (!userMessage || userMessage.role !== MessageRole.USER) {
      return {
        currentStep: 'tool_routing',
        shouldContinue: false
      };
    }

    const shouldUseTools = await this.toolManager.shouldUseTools(
      userMessage.content,
      state.config.enabledTools,
      state.memory.context
    );

    return {
      currentStep: 'tool_routing',
      shouldContinue: shouldUseTools,
      metadata: {
        ...state.metadata,
        nodeHistory: [...state.metadata.nodeHistory, 'tool_routing']
      }
    };
  }

  /**
   * Tool Execution Node - รัน tools ที่จำเป็น
   */
  private async toolExecutionNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'tool_execution',
      conversationId: state.conversationId
    });

    if (!state.currentMessage) {
      throw new Error('No current message for tool execution');
    }

    try {
      const toolResults = await this.toolManager.executeTools(
        state.currentMessage.content,
        state.config.enabledTools,
        {
          conversationId: state.conversationId,
          memory: state.memory,
          config: state.config
        },
        (event) => this.emitEvent(event.type, event.data)
      );

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
    } catch (error) {
      this.emitEvent(StreamingEventType.WORKFLOW_ERROR, {
        step: 'tool_execution',
        error: error instanceof Error ? error.message : 'Tool execution failed',
        conversationId: state.conversationId
      });
      throw error;
    }
  }

  /**
   * LLM Generation Node - สร้าง response ด้วย LLM
   */
  private async llmGenerationNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'llm_generation',
      conversationId: state.conversationId
    });

    if (!state.currentMessage) {
      throw new Error('No current message for LLM generation');
    }

    try {
      // เริ่ม streaming
      this.emitEvent(StreamingEventType.MESSAGE_STARTED, {
        conversationId: state.conversationId,
        messageId: state.currentMessage.id
      });

      const response = await this.llmManager.generateResponse(
        {
          messages: state.messages,
          currentMessage: state.currentMessage,
          memory: state.memory,
          toolOutput: state.toolOutput,
          config: state.config
        },
        (chunk) => {
          this.emitEvent(StreamingEventType.MESSAGE_CHUNK, {
            conversationId: state.conversationId,
            messageId: state.currentMessage!.id,
            chunk,
            isStreaming: true
          });
        }
      );

      return {
        currentStep: 'llm_generation',
        streamingActive: false,
        metadata: {
          ...state.metadata,
          totalTokens: state.metadata.totalTokens + (response.tokenUsage?.totalTokens || 0),
          nodeHistory: [...state.metadata.nodeHistory, 'llm_generation']
        }
      };
    } catch (error) {
      this.emitEvent(StreamingEventType.MESSAGE_FAILED, {
        conversationId: state.conversationId,
        messageId: state.currentMessage.id,
        error: error instanceof Error ? error.message : 'LLM generation failed'
      });
      throw error;
    }
  }

  /**
   * Memory Update Node - อัพเดท memory หลังจาก conversation
   */
  private async memoryUpdateNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'memory_update',
      conversationId: state.conversationId
    });

    try {
      await this.memoryManager.updateMemory(
        state.conversationId,
        state.messages,
        state.config.memorySettings
      );

      return {
        currentStep: 'memory_update',
        memoryUpdated: true,
        metadata: {
          ...state.metadata,
          nodeHistory: [...state.metadata.nodeHistory, 'memory_update']
        }
      };
    } catch (error) {
      this.emitEvent(StreamingEventType.WORKFLOW_ERROR, {
        step: 'memory_update',
        error: error instanceof Error ? error.message : 'Memory update failed',
        conversationId: state.conversationId
      });
      // Memory update failure shouldn't stop the workflow
      return {
        currentStep: 'memory_update',
        memoryUpdated: false
      };
    }
  }

  /**
   * Response Finalization Node - สรุปและ finalize response
   */
  private async responseFinalizationNode(state: ConversationWorkflowState): Promise<Partial<ConversationWorkflowState>> {
    this.emitEvent(StreamingEventType.WORKFLOW_STEP, {
      step: 'response_finalization',
      conversationId: state.conversationId
    });

    if (state.currentMessage) {
      this.emitEvent(StreamingEventType.MESSAGE_COMPLETED, {
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

  // ============= CONDITIONAL LOGIC =============

  private shouldExecuteTools(state: ConversationWorkflowState): string {
    return state.shouldContinue ? 'execute_tools' : 'skip_tools';
  }

  // ============= PUBLIC API =============

  /**
   * รัน conversation workflow
   */
  public async runConversation(
    conversationId: string,
    message: ConversationMessage,
    config: any
  ): Promise<any> {
    const initialState: ConversationWorkflowState = {
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
      const result = await this.graph.invoke(initialState);
      return result;
    } catch (error) {
      this.emitEvent(StreamingEventType.ERROR, {
        conversationId,
        error: error instanceof Error ? error.message : 'Workflow execution failed'
      });
      throw error;
    }
  }

  // ============= EVENT MANAGEMENT =============

  private emitEvent(type: StreamingEventType, data: any): void {
    const event: StreamingEvent = {
      type,
      conversationId: data.conversationId,
      messageId: data.messageId,
      data,
      timestamp: new Date()
    };

    console.log(`📡 Workflow Event: ${type}`, data);
    this.emit('workflow_event', event);
  }

  // ============= CLEANUP =============

  public cleanup(): void {
    this.memoryManager.cleanup();
    this.toolManager.cleanup();
    this.llmManager.cleanup();
    this.removeAllListeners();
  }
}