"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentQuerySchema = exports.updateAgentSchema = exports.agentResponseSchema = exports.createAgentSchema = exports.agentToolSchema = void 0;
const zod_1 = require("zod");
exports.agentToolSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Tool ID is required'),
    name: zod_1.z.string().min(1, 'Tool name is required'),
    description: zod_1.z.string().default(''),
    type: zod_1.z.enum(['function', 'retriever', 'web_search', 'calculator', 'current_date', 'memory_search', 'memory_embed']),
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).default({}),
    enabled: zod_1.z.boolean().default(true)
});
exports.createAgentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Agent name is required').max(100, 'Agent name too long'),
    description: zod_1.z.string().default(''),
    systemPrompt: zod_1.z.string().default(''),
    modelId: zod_1.z.string().min(1, 'Model ID is required'),
    collectionNames: zod_1.z.array(zod_1.z.string()).default([]),
    tools: zod_1.z.array(exports.agentToolSchema).default([]),
    temperature: zod_1.z.number().min(0).max(2).default(0.7),
    maxTokens: zod_1.z.number().min(1).max(32000).default(4000),
    isPublic: zod_1.z.boolean().default(false),
    tags: zod_1.z.array(zod_1.z.string()).default([])
});
exports.agentResponseSchema = exports.createAgentSchema.extend({
    id: zod_1.z.string(),
    createdBy: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    usageCount: zod_1.z.number().default(0),
    rating: zod_1.z.number().default(0.0)
});
exports.updateAgentSchema = exports.createAgentSchema.partial();
exports.agentQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    tags: zod_1.z.string().optional(),
    isPublic: zod_1.z.boolean().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(50),
    offset: zod_1.z.number().min(0).optional().default(0)
});
//# sourceMappingURL=agentSchema.js.map