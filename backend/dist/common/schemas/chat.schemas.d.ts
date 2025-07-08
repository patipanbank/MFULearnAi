import { z } from 'zod';
export declare const mongoIdSchema: z.ZodString;
export declare const messageContentSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const chatNameSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const createChatSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    agentId: z.ZodOptional<z.ZodString>;
    initialMessage: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    agentId?: string | undefined;
    initialMessage?: string | undefined;
}, {
    name?: string | undefined;
    agentId?: string | undefined;
    initialMessage?: string | undefined;
}>;
export declare const updateChatSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
export declare const sendMessageSchema: z.ZodObject<{
    content: z.ZodEffects<z.ZodString, string, string>;
    type: z.ZodDefault<z.ZodEnum<["user", "system"]>>;
    agentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "system" | "user";
    content: string;
    agentId?: string | undefined;
}, {
    content: string;
    type?: "system" | "user" | undefined;
    agentId?: string | undefined;
}>;
export declare const getChatMessagesSchema: z.ZodObject<{
    limit: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    offset: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, number, string | undefined>;
    before: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    before?: string | undefined;
}, {
    limit?: string | undefined;
    offset?: string | undefined;
    before?: string | undefined;
}>;
export declare const chatParamsSchema: z.ZodObject<{
    chatId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
}, {
    chatId: string;
}>;
export declare const messageParamsSchema: z.ZodObject<{
    chatId: z.ZodString;
    messageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
    messageId: string;
}, {
    chatId: string;
    messageId: string;
}>;
export declare const joinRoomSchema: z.ZodObject<{
    chatId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
}, {
    chatId: string;
}>;
export declare const leaveRoomSchema: z.ZodObject<{
    chatId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
}, {
    chatId: string;
}>;
export declare const typingStartSchema: z.ZodObject<{
    chatId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
}, {
    chatId: string;
}>;
export declare const typingStopSchema: z.ZodObject<{
    chatId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chatId: string;
}, {
    chatId: string;
}>;
export declare const wsMessageSchema: z.ZodObject<{
    chatId: z.ZodString;
    content: z.ZodEffects<z.ZodString, string, string>;
    type: z.ZodDefault<z.ZodEnum<["user", "system"]>>;
}, "strip", z.ZodTypeAny, {
    chatId: string;
    type: "system" | "user";
    content: string;
}, {
    chatId: string;
    content: string;
    type?: "system" | "user" | undefined;
}>;
export declare const executeAgentSchema: z.ZodObject<{
    chatId: z.ZodString;
    message: z.ZodEffects<z.ZodString, string, string>;
    agentId: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
        timestamp: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }, {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    chatId: string;
    context?: {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }[] | undefined;
    agentId?: string | undefined;
}, {
    message: string;
    chatId: string;
    context?: {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }[] | undefined;
    agentId?: string | undefined;
}>;
export declare const agentExecutionParamsSchema: z.ZodObject<{
    executionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    executionId: string;
}, {
    executionId: string;
}>;
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
