import { z } from 'zod';
export declare const streamEventTypeSchema: z.ZodEnum<["stream_start", "stream_chunk", "stream_tool_call", "stream_tool_result", "stream_complete", "stream_error"]>;
export declare const baseStreamEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    sessionId: string;
    executionId: string;
}, {
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamStartEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_start">;
    data: z.ZodObject<{
        agentId: z.ZodString;
        userId: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        userId: string;
        agentId: string;
    }, {
        message: string;
        userId: string;
        agentId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        message: string;
        userId: string;
        agentId: string;
    };
    type: "stream_start";
    sessionId: string;
    executionId: string;
}, {
    data: {
        message: string;
        userId: string;
        agentId: string;
    };
    type: "stream_start";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamChunkEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_chunk">;
    data: z.ZodObject<{
        chunk: z.ZodString;
        accumulated: z.ZodOptional<z.ZodString>;
        tokens: z.ZodOptional<z.ZodObject<{
            input: z.ZodOptional<z.ZodNumber>;
            output: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            input?: number | undefined;
            output?: number | undefined;
        }, {
            input?: number | undefined;
            output?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    }, {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    };
    type: "stream_chunk";
    sessionId: string;
    executionId: string;
}, {
    data: {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    };
    type: "stream_chunk";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamToolCallEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_tool_call">;
    data: z.ZodObject<{
        toolName: z.ZodString;
        toolParams: z.ZodRecord<z.ZodString, z.ZodAny>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    }, {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    };
    type: "stream_tool_call";
    sessionId: string;
    executionId: string;
}, {
    data: {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    };
    type: "stream_tool_call";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamToolResultEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_tool_result">;
    data: z.ZodObject<{
        toolName: z.ZodString;
        result: z.ZodAny;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    }, {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    };
    type: "stream_tool_result";
    sessionId: string;
    executionId: string;
}, {
    data: {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    };
    type: "stream_tool_result";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamCompleteEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_complete">;
    data: z.ZodObject<{
        finalResponse: z.ZodString;
        toolsUsed: z.ZodArray<z.ZodString, "many">;
        tokenUsage: z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            input: number;
            output: number;
        }, {
            input: number;
            output: number;
        }>;
        executionTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    }, {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    };
    type: "stream_complete";
    sessionId: string;
    executionId: string;
}, {
    data: {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    };
    type: "stream_complete";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamErrorEventSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_error">;
    data: z.ZodObject<{
        error: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    }, {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    };
    type: "stream_error";
    sessionId: string;
    executionId: string;
}, {
    data: {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    };
    type: "stream_error";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>;
export declare const streamEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_start">;
    data: z.ZodObject<{
        agentId: z.ZodString;
        userId: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        userId: string;
        agentId: string;
    }, {
        message: string;
        userId: string;
        agentId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        message: string;
        userId: string;
        agentId: string;
    };
    type: "stream_start";
    sessionId: string;
    executionId: string;
}, {
    data: {
        message: string;
        userId: string;
        agentId: string;
    };
    type: "stream_start";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_chunk">;
    data: z.ZodObject<{
        chunk: z.ZodString;
        accumulated: z.ZodOptional<z.ZodString>;
        tokens: z.ZodOptional<z.ZodObject<{
            input: z.ZodOptional<z.ZodNumber>;
            output: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            input?: number | undefined;
            output?: number | undefined;
        }, {
            input?: number | undefined;
            output?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    }, {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    };
    type: "stream_chunk";
    sessionId: string;
    executionId: string;
}, {
    data: {
        chunk: string;
        accumulated?: string | undefined;
        tokens?: {
            input?: number | undefined;
            output?: number | undefined;
        } | undefined;
    };
    type: "stream_chunk";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_tool_call">;
    data: z.ZodObject<{
        toolName: z.ZodString;
        toolParams: z.ZodRecord<z.ZodString, z.ZodAny>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    }, {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    };
    type: "stream_tool_call";
    sessionId: string;
    executionId: string;
}, {
    data: {
        toolName: string;
        toolParams: Record<string, any>;
        reasoning?: string | undefined;
    };
    type: "stream_tool_call";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_tool_result">;
    data: z.ZodObject<{
        toolName: z.ZodString;
        result: z.ZodAny;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    }, {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    };
    type: "stream_tool_result";
    sessionId: string;
    executionId: string;
}, {
    data: {
        success: boolean;
        toolName: string;
        error?: string | undefined;
        result?: any;
    };
    type: "stream_tool_result";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_complete">;
    data: z.ZodObject<{
        finalResponse: z.ZodString;
        toolsUsed: z.ZodArray<z.ZodString, "many">;
        tokenUsage: z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            input: number;
            output: number;
        }, {
            input: number;
            output: number;
        }>;
        executionTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    }, {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    };
    type: "stream_complete";
    sessionId: string;
    executionId: string;
}, {
    data: {
        tokenUsage: {
            input: number;
            output: number;
        };
        finalResponse: string;
        toolsUsed: string[];
        executionTime: number;
    };
    type: "stream_complete";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>, z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodString;
    timestamp: z.ZodDefault<z.ZodDate>;
} & {
    type: z.ZodLiteral<"stream_error">;
    data: z.ZodObject<{
        error: z.ZodString;
        code: z.ZodOptional<z.ZodString>;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    }, {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    data: {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    };
    type: "stream_error";
    sessionId: string;
    executionId: string;
}, {
    data: {
        error: string;
        code?: string | undefined;
        details?: Record<string, any> | undefined;
    };
    type: "stream_error";
    sessionId: string;
    executionId: string;
    timestamp?: Date | undefined;
}>]>;
export declare const wsStreamSubscribeSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    executionId?: string | undefined;
}, {
    sessionId: string;
    executionId?: string | undefined;
}>;
export declare const wsStreamUnsubscribeSchema: z.ZodObject<{
    sessionId: z.ZodString;
    executionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    executionId?: string | undefined;
}, {
    sessionId: string;
    executionId?: string | undefined;
}>;
export declare const streamingAgentExecutionRequestSchema: z.ZodObject<{
    agentId: z.ZodString;
    sessionId: z.ZodString;
    userId: z.ZodString;
    message: z.ZodString;
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
    streaming: z.ZodDefault<z.ZodBoolean>;
    streamingOptions: z.ZodOptional<z.ZodObject<{
        enableToolStreaming: z.ZodDefault<z.ZodBoolean>;
        enableProgressUpdates: z.ZodDefault<z.ZodBoolean>;
        chunkDelay: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enableToolStreaming: boolean;
        enableProgressUpdates: boolean;
        chunkDelay: number;
    }, {
        enableToolStreaming?: boolean | undefined;
        enableProgressUpdates?: boolean | undefined;
        chunkDelay?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    userId: string;
    agentId: string;
    sessionId: string;
    streaming: boolean;
    context?: {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }[] | undefined;
    streamingOptions?: {
        enableToolStreaming: boolean;
        enableProgressUpdates: boolean;
        chunkDelay: number;
    } | undefined;
}, {
    message: string;
    userId: string;
    agentId: string;
    sessionId: string;
    context?: {
        content: string;
        role: "system" | "user" | "assistant";
        timestamp?: Date | undefined;
    }[] | undefined;
    streaming?: boolean | undefined;
    streamingOptions?: {
        enableToolStreaming?: boolean | undefined;
        enableProgressUpdates?: boolean | undefined;
        chunkDelay?: number | undefined;
    } | undefined;
}>;
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
