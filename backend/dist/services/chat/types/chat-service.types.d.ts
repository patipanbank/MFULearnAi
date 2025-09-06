export interface ChatConfig {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
}
export interface ProcessingOptions {
    maxSteps?: number;
    images?: Array<{
        url: string;
        mediaType: string;
        base64Data?: string;
    }>;
}
export interface EventCallback {
    (event: {
        type: string;
        data?: any;
    }): Promise<void>;
}
export interface MemoryConfig {
    messageCount: number;
    useMemoryTool: boolean;
    useRedisMemory: boolean;
    shouldEmbed: boolean;
}
export interface AgentCacheEntry {
    signature: string;
    executor: any;
}
export interface ImageData {
    url: string;
    mediaType: string;
    base64Data?: string;
}
//# sourceMappingURL=chat-service.types.d.ts.map