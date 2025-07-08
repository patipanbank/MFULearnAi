"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentExecutionParamsSchema = exports.executeAgentSchema = exports.wsMessageSchema = exports.typingStopSchema = exports.typingStartSchema = exports.leaveRoomSchema = exports.joinRoomSchema = exports.messageParamsSchema = exports.chatParamsSchema = exports.getChatMessagesSchema = exports.sendMessageSchema = exports.updateChatSchema = exports.createChatSchema = exports.chatNameSchema = exports.messageContentSchema = exports.mongoIdSchema = void 0;
const zod_1 = require("zod");
exports.mongoIdSchema = zod_1.z
    .string({
    required_error: 'ID is required',
    invalid_type_error: 'ID must be a string',
})
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');
exports.messageContentSchema = zod_1.z
    .string({
    required_error: 'Message content is required',
    invalid_type_error: 'Message content must be a string',
})
    .min(1, 'Message content cannot be empty')
    .max(10000, 'Message content must be less than 10,000 characters')
    .transform(content => content.trim());
exports.chatNameSchema = zod_1.z
    .string({
    required_error: 'Chat name is required',
    invalid_type_error: 'Chat name must be a string',
})
    .min(1, 'Chat name is required')
    .max(100, 'Chat name must be less than 100 characters')
    .transform(name => name.trim());
exports.createChatSchema = zod_1.z.object({
    name: exports.chatNameSchema.optional(),
    agentId: exports.mongoIdSchema.optional(),
    initialMessage: exports.messageContentSchema.optional(),
});
exports.updateChatSchema = zod_1.z.object({
    name: exports.chatNameSchema.optional(),
});
exports.sendMessageSchema = zod_1.z.object({
    content: exports.messageContentSchema,
    type: zod_1.z.enum(['user', 'system']).default('user'),
    agentId: exports.mongoIdSchema.optional(),
});
exports.getChatMessagesSchema = zod_1.z.object({
    limit: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 50)
        .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    offset: zod_1.z
        .string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : 0)
        .refine(val => val >= 0, 'Offset must be non-negative'),
    before: zod_1.z
        .string()
        .optional()
        .refine(val => !val || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(val), 'Invalid date format'),
});
exports.chatParamsSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
});
exports.messageParamsSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
    messageId: exports.mongoIdSchema,
});
exports.joinRoomSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
});
exports.leaveRoomSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
});
exports.typingStartSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
});
exports.typingStopSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
});
exports.wsMessageSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
    content: exports.messageContentSchema,
    type: zod_1.z.enum(['user', 'system']).default('user'),
});
exports.executeAgentSchema = zod_1.z.object({
    chatId: exports.mongoIdSchema,
    message: exports.messageContentSchema,
    agentId: exports.mongoIdSchema.optional(),
    context: zod_1.z
        .array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant', 'system']),
        content: zod_1.z.string(),
        timestamp: zod_1.z.date().optional(),
    }))
        .optional(),
});
exports.agentExecutionParamsSchema = zod_1.z.object({
    executionId: exports.mongoIdSchema,
});
//# sourceMappingURL=chat.schemas.js.map