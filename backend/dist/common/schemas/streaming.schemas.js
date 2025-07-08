"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamingAgentExecutionRequestSchema = exports.wsStreamUnsubscribeSchema = exports.wsStreamSubscribeSchema = exports.streamEventSchema = exports.streamErrorEventSchema = exports.streamCompleteEventSchema = exports.streamToolResultEventSchema = exports.streamToolCallEventSchema = exports.streamChunkEventSchema = exports.streamStartEventSchema = exports.baseStreamEventSchema = exports.streamEventTypeSchema = void 0;
const zod_1 = require("zod");
const chat_schemas_1 = require("./chat.schemas");
exports.streamEventTypeSchema = zod_1.z.enum([
    'stream_start',
    'stream_chunk',
    'stream_tool_call',
    'stream_tool_result',
    'stream_complete',
    'stream_error'
]);
exports.baseStreamEventSchema = zod_1.z.object({
    sessionId: chat_schemas_1.mongoIdSchema,
    executionId: chat_schemas_1.mongoIdSchema,
    timestamp: zod_1.z.date().default(() => new Date()),
});
exports.streamStartEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_start'),
    data: zod_1.z.object({
        agentId: chat_schemas_1.mongoIdSchema,
        userId: chat_schemas_1.mongoIdSchema,
        message: zod_1.z.string(),
    }),
});
exports.streamChunkEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_chunk'),
    data: zod_1.z.object({
        chunk: zod_1.z.string(),
        accumulated: zod_1.z.string().optional(),
        tokens: zod_1.z.object({
            input: zod_1.z.number().optional(),
            output: zod_1.z.number().optional(),
        }).optional(),
    }),
});
exports.streamToolCallEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_tool_call'),
    data: zod_1.z.object({
        toolName: zod_1.z.string(),
        toolParams: zod_1.z.record(zod_1.z.any()),
        reasoning: zod_1.z.string().optional(),
    }),
});
exports.streamToolResultEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_tool_result'),
    data: zod_1.z.object({
        toolName: zod_1.z.string(),
        result: zod_1.z.any(),
        success: zod_1.z.boolean(),
        error: zod_1.z.string().optional(),
    }),
});
exports.streamCompleteEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_complete'),
    data: zod_1.z.object({
        finalResponse: zod_1.z.string(),
        toolsUsed: zod_1.z.array(zod_1.z.string()),
        tokenUsage: zod_1.z.object({
            input: zod_1.z.number(),
            output: zod_1.z.number(),
        }),
        executionTime: zod_1.z.number(),
    }),
});
exports.streamErrorEventSchema = exports.baseStreamEventSchema.extend({
    type: zod_1.z.literal('stream_error'),
    data: zod_1.z.object({
        error: zod_1.z.string(),
        code: zod_1.z.string().optional(),
        details: zod_1.z.record(zod_1.z.any()).optional(),
    }),
});
exports.streamEventSchema = zod_1.z.discriminatedUnion('type', [
    exports.streamStartEventSchema,
    exports.streamChunkEventSchema,
    exports.streamToolCallEventSchema,
    exports.streamToolResultEventSchema,
    exports.streamCompleteEventSchema,
    exports.streamErrorEventSchema,
]);
exports.wsStreamSubscribeSchema = zod_1.z.object({
    sessionId: chat_schemas_1.mongoIdSchema,
    executionId: chat_schemas_1.mongoIdSchema.optional(),
});
exports.wsStreamUnsubscribeSchema = zod_1.z.object({
    sessionId: chat_schemas_1.mongoIdSchema,
    executionId: chat_schemas_1.mongoIdSchema.optional(),
});
exports.streamingAgentExecutionRequestSchema = zod_1.z.object({
    agentId: chat_schemas_1.mongoIdSchema,
    sessionId: chat_schemas_1.mongoIdSchema,
    userId: chat_schemas_1.mongoIdSchema,
    message: zod_1.z.string().min(1, 'Message cannot be empty'),
    context: zod_1.z
        .array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant', 'system']),
        content: zod_1.z.string(),
        timestamp: zod_1.z.date().optional(),
    }))
        .optional(),
    streaming: zod_1.z.boolean().default(true),
    streamingOptions: zod_1.z.object({
        enableToolStreaming: zod_1.z.boolean().default(true),
        enableProgressUpdates: zod_1.z.boolean().default(true),
        chunkDelay: zod_1.z.number().min(0).max(1000).default(0),
    }).optional(),
});
//# sourceMappingURL=streaming.schemas.js.map