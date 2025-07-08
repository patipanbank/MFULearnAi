import { z } from 'zod';
import { mongoIdSchema } from './chat.schemas';

// Streaming event types
export const streamEventTypeSchema = z.enum([
  'stream_start',
  'stream_chunk', 
  'stream_tool_call',
  'stream_tool_result',
  'stream_complete',
  'stream_error'
]);

// Base streaming event schema
export const baseStreamEventSchema = z.object({
  sessionId: mongoIdSchema,
  executionId: mongoIdSchema,
  timestamp: z.date().default(() => new Date()),
});

// Streaming event schemas
export const streamStartEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_start'),
  data: z.object({
    agentId: mongoIdSchema,
    userId: mongoIdSchema,
    message: z.string(),
  }),
});

export const streamChunkEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_chunk'),
  data: z.object({
    chunk: z.string(),
    accumulated: z.string().optional(),
    tokens: z.object({
      input: z.number().optional(),
      output: z.number().optional(),
    }).optional(),
  }),
});

export const streamToolCallEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_tool_call'),
  data: z.object({
    toolName: z.string(),
    toolParams: z.record(z.any()),
    reasoning: z.string().optional(),
  }),
});

export const streamToolResultEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_tool_result'),
  data: z.object({
    toolName: z.string(),
    result: z.any(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
});

export const streamCompleteEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_complete'),
  data: z.object({
    finalResponse: z.string(),
    toolsUsed: z.array(z.string()),
    tokenUsage: z.object({
      input: z.number(),
      output: z.number(),
    }),
    executionTime: z.number(),
  }),
});

export const streamErrorEventSchema = baseStreamEventSchema.extend({
  type: z.literal('stream_error'),
  data: z.object({
    error: z.string(),
    code: z.string().optional(),
    details: z.record(z.any()).optional(),
  }),
});

// Union type for all streaming events
export const streamEventSchema = z.discriminatedUnion('type', [
  streamStartEventSchema,
  streamChunkEventSchema,
  streamToolCallEventSchema,
  streamToolResultEventSchema,
  streamCompleteEventSchema,
  streamErrorEventSchema,
]);

// WebSocket streaming events
export const wsStreamSubscribeSchema = z.object({
  sessionId: mongoIdSchema,
  executionId: mongoIdSchema.optional(),
});

export const wsStreamUnsubscribeSchema = z.object({
  sessionId: mongoIdSchema,
  executionId: mongoIdSchema.optional(),
});

// Agent execution request for streaming
export const streamingAgentExecutionRequestSchema = z.object({
  agentId: mongoIdSchema,
  sessionId: mongoIdSchema,
  userId: mongoIdSchema,
  message: z.string().min(1, 'Message cannot be empty'),
  context: z
    .array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.date().optional(),
    }))
    .optional(),
  streaming: z.boolean().default(true),
  streamingOptions: z.object({
    enableToolStreaming: z.boolean().default(true),
    enableProgressUpdates: z.boolean().default(true),
    chunkDelay: z.number().min(0).max(1000).default(0),
  }).optional(),
});

// Type inference
export type StreamEventType = z.infer<typeof streamEventTypeSchema>;
export type BaseStreamEvent = z.infer<typeof baseStreamEventSchema>;

export type StreamStartEvent = z.infer<typeof streamStartEventSchema>;
export type StreamChunkEvent = z.infer<typeof streamChunkEventSchema>;
export type StreamToolCallEvent = z.infer<typeof streamToolCallEventSchema>;
export type StreamToolResultEvent = z.infer<typeof streamToolResultEventSchema>;
export type StreamCompleteEvent = z.infer<typeof streamCompleteEventSchema>;
export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>;

export type StreamEvent = z.infer<typeof streamEventSchema>;

export type WsStreamSubscribeDto = z.infer<typeof wsStreamSubscribeSchema>;
export type WsStreamUnsubscribeDto = z.infer<typeof wsStreamUnsubscribeSchema>;
export type StreamingAgentExecutionRequest = z.infer<typeof streamingAgentExecutionRequestSchema>; 