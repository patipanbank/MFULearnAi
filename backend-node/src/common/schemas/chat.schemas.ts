import { z } from 'zod';

// Base validation schemas
export const mongoIdSchema = z
  .string({
    required_error: 'ID is required',
    invalid_type_error: 'ID must be a string',
  })
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');

export const messageContentSchema = z
  .string({
    required_error: 'Message content is required',
    invalid_type_error: 'Message content must be a string',
  })
  .min(1, 'Message content cannot be empty')
  .max(10000, 'Message content must be less than 10,000 characters')
  .transform(content => content.trim());

export const chatNameSchema = z
  .string({
    required_error: 'Chat name is required',
    invalid_type_error: 'Chat name must be a string',
  })
  .min(1, 'Chat name is required')
  .max(100, 'Chat name must be less than 100 characters')
  .transform(name => name.trim());

// Chat DTO Schemas
export const createChatSchema = z.object({
  name: chatNameSchema.optional(),
  agentId: mongoIdSchema.optional(),
  initialMessage: messageContentSchema.optional(),
});

export const updateChatSchema = z.object({
  name: chatNameSchema.optional(),
});

export const sendMessageSchema = z.object({
  content: messageContentSchema,
  type: z.enum(['user', 'system']).default('user'),
  agentId: mongoIdSchema.optional(),
});

export const getChatMessagesSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 50)
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  offset: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 0)
    .refine(val => val >= 0, 'Offset must be non-negative'),
  before: z
    .string()
    .optional()
    .refine(val => !val || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(val), 'Invalid date format'),
});

export const chatParamsSchema = z.object({
  chatId: mongoIdSchema,
});

export const messageParamsSchema = z.object({
  chatId: mongoIdSchema,
  messageId: mongoIdSchema,
});

// WebSocket schemas
export const joinRoomSchema = z.object({
  chatId: mongoIdSchema,
});

export const leaveRoomSchema = z.object({
  chatId: mongoIdSchema,
});

export const typingStartSchema = z.object({
  chatId: mongoIdSchema,
});

export const typingStopSchema = z.object({
  chatId: mongoIdSchema,
});

export const wsMessageSchema = z.object({
  chatId: mongoIdSchema,
  content: messageContentSchema,
  type: z.enum(['user', 'system']).default('user'),
});

// Agent execution schemas
export const executeAgentSchema = z.object({
  chatId: mongoIdSchema,
  message: messageContentSchema,
  agentId: mongoIdSchema.optional(),
  context: z
    .array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.date().optional(),
    }))
    .optional(),
});

export const agentExecutionParamsSchema = z.object({
  executionId: mongoIdSchema,
});

// Type inference
export type CreateChatDto = z.infer<typeof createChatSchema>;
export type UpdateChatDto = z.infer<typeof updateChatSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type GetChatMessagesQuery = z.infer<typeof getChatMessagesSchema>;
export type ChatParamsDto = z.infer<typeof chatParamsSchema>;
export type MessageParamsDto = z.infer<typeof messageParamsSchema>;

export type JoinRoomDto = z.infer<typeof joinRoomSchema>;
export type LeaveRoomDto = z.infer<typeof leaveRoomSchema>;
export type TypingStartDto = z.infer<typeof typingStartSchema>;
export type TypingStopDto = z.infer<typeof typingStopSchema>;
export type WsMessageDto = z.infer<typeof wsMessageSchema>;

export type ExecuteAgentDto = z.infer<typeof executeAgentSchema>;
export type AgentExecutionParamsDto = z.infer<typeof agentExecutionParamsSchema>; 