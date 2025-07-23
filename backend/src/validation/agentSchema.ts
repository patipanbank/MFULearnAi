import { z } from 'zod';

// Agent Tool Schema
export const agentToolSchema = z.object({
  id: z.string().min(1, 'Tool ID is required'),
  name: z.string().min(1, 'Tool name is required'),
  description: z.string().default(''),
  type: z.enum(['function', 'retriever', 'web_search', 'calculator', 'current_date', 'memory_search', 'memory_embed'] as const),
  config: z.record(z.string(), z.any()).default({}),
  enabled: z.boolean().default(true)
});

// Agent Schema for creating/updating
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100, 'Agent name too long'),
  description: z.string().default(''),
  systemPrompt: z.string().default(''),
  modelId: z.string().min(1, 'Model ID is required'),
  collectionNames: z.array(z.string()).default([]),
  tools: z.array(agentToolSchema).default([]),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(32000).default(4000),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([])
});

// Agent Schema for response (includes generated fields)
export const agentResponseSchema = createAgentSchema.extend({
  id: z.string(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  usageCount: z.number().default(0),
  rating: z.number().default(0.0)
});

// Update Agent Schema (all fields optional except id)
export const updateAgentSchema = createAgentSchema.partial();

// Query parameters for filtering agents
export const agentQuerySchema = z.object({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated tags
  isPublic: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0)
});

// Type exports
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type AgentQuery = z.infer<typeof agentQuerySchema>;
export type AgentTool = z.infer<typeof agentToolSchema>; 