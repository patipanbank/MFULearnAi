import { z } from 'zod';
export declare const agentToolSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    type: z.ZodEnum<{
        function: "function";
        retriever: "retriever";
        web_search: "web_search";
        calculator: "calculator";
        current_date: "current_date";
        memory_search: "memory_search";
        memory_embed: "memory_embed";
    }>;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const createAgentSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    systemPrompt: z.ZodDefault<z.ZodString>;
    modelId: z.ZodString;
    collectionNames: z.ZodDefault<z.ZodArray<z.ZodString>>;
    tools: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        type: z.ZodEnum<{
            function: "function";
            retriever: "retriever";
            web_search: "web_search";
            calculator: "calculator";
            current_date: "current_date";
            memory_search: "memory_search";
            memory_embed: "memory_embed";
        }>;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const agentResponseSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    systemPrompt: z.ZodDefault<z.ZodString>;
    modelId: z.ZodString;
    collectionNames: z.ZodDefault<z.ZodArray<z.ZodString>>;
    tools: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        type: z.ZodEnum<{
            function: "function";
            retriever: "retriever";
            web_search: "web_search";
            calculator: "calculator";
            current_date: "current_date";
            memory_search: "memory_search";
            memory_embed: "memory_embed";
        }>;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    id: z.ZodString;
    createdBy: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    usageCount: z.ZodDefault<z.ZodNumber>;
    rating: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateAgentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    systemPrompt: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    modelId: z.ZodOptional<z.ZodString>;
    collectionNames: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    tools: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        type: z.ZodEnum<{
            function: "function";
            retriever: "retriever";
            web_search: "web_search";
            calculator: "calculator";
            current_date: "current_date";
            memory_search: "memory_search";
            memory_embed: "memory_embed";
        }>;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    temperature: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxTokens: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    isPublic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    tags: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export declare const agentQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    offset: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type AgentQuery = z.infer<typeof agentQuerySchema>;
export type AgentTool = z.infer<typeof agentToolSchema>;
//# sourceMappingURL=agentSchema.d.ts.map