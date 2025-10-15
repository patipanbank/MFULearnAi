import { BaseMessage } from "@langchain/core/messages";

/**
 * Chat State Schema for LangGraph
 * Defines the structure of state that flows through the graph
 */
export interface ChatState {
  // Core message history
  messages: BaseMessage[];

  // Chat session identifiers
  chatId: string;
  userId: string;
  sessionId: string;

  // Agent configuration
  agentId?: string;
  modelId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;

  // RAG configuration
  collectionNames?: string[];

  // Tool configuration
  tools: string[];
  allowedTools?: string[];

  // Execution state
  currentIteration: number;
  maxIterations: number;
  shouldContinue: boolean;

  // Tool execution results
  toolResults?: Array<{
    toolName: string;
    input: string;
    output: string;
    timestamp: Date;
  }>;

  // Metadata
  metadata: Record<string, any>;

  // Error handling
  error?: string;
  errorDetails?: any;
}

/**
 * Initial state factory
 */
export function createInitialChatState(params: {
  chatId: string;
  userId: string;
  sessionId: string;
  agentId?: string;
  maxIterations?: number;
}): ChatState {
  return {
    messages: [],
    chatId: params.chatId,
    userId: params.userId,
    sessionId: params.sessionId,
    agentId: params.agentId,
    tools: [],
    currentIteration: 0,
    maxIterations: params.maxIterations || 5,
    shouldContinue: true,
    metadata: {},
  };
}

/**
 * State channels configuration for LangGraph
 * Defines how state is merged when multiple nodes update it
 */
export const chatStateChannels = {
  messages: {
    value: (prev: BaseMessage[], next: BaseMessage[]) => [...prev, ...next],
    default: () => [] as BaseMessage[],
  },
  chatId: {
    value: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  userId: {
    value: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  sessionId: {
    value: (prev: string, next: string) => next || prev,
    default: () => '',
  },
  agentId: {
    value: (prev: string | undefined, next: string | undefined) => next || prev,
    default: () => undefined,
  },
  modelId: {
    value: (prev: string | undefined, next: string | undefined) => next || prev,
    default: () => undefined,
  },
  systemPrompt: {
    value: (prev: string | undefined, next: string | undefined) => next || prev,
    default: () => undefined,
  },
  temperature: {
    value: (prev: number | undefined, next: number | undefined) => next ?? prev,
    default: () => 0.7,
  },
  maxTokens: {
    value: (prev: number | undefined, next: number | undefined) => next ?? prev,
    default: () => 4000,
  },
  collectionNames: {
    value: (prev: string[] | undefined, next: string[] | undefined) => next || prev,
    default: () => [],
  },
  tools: {
    value: (prev: string[], next: string[]) => {
      // Merge unique tools
      const merged = [...prev, ...next];
      return Array.from(new Set(merged));
    },
    default: () => [] as string[],
  },
  allowedTools: {
    value: (prev: string[] | undefined, next: string[] | undefined) => next || prev,
    default: () => undefined,
  },
  currentIteration: {
    value: (prev: number, next: number) => next ?? prev,
    default: () => 0,
  },
  maxIterations: {
    value: (prev: number, next: number) => next ?? prev,
    default: () => 5,
  },
  shouldContinue: {
    value: (prev: boolean, next: boolean) => next ?? prev,
    default: () => true,
  },
  toolResults: {
    value: (
      prev: Array<{ toolName: string; input: string; output: string; timestamp: Date }> | undefined,
      next: Array<{ toolName: string; input: string; output: string; timestamp: Date }> | undefined
    ) => {
      if (!prev && !next) return [];
      if (!prev) return next;
      if (!next) return prev;
      return [...prev, ...next];
    },
    default: () => [],
  },
  metadata: {
    value: (prev: Record<string, any>, next: Record<string, any>) => ({
      ...prev,
      ...next,
    }),
    default: () => ({}) as Record<string, any>,
  },
  error: {
    value: (prev: string | undefined, next: string | undefined) => next || prev,
    default: () => undefined,
  },
  errorDetails: {
    value: (prev: any, next: any) => next || prev,
    default: () => undefined,
  },
};
