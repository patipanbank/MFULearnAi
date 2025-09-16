export interface AgentCacheEntry {
    executor: any;
    createdAt: Date;
    lastUsed: Date;
    hitCount: number;
    signature: string;
}
export interface AgentConfig {
    modelId: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    collectionNames: string[];
    sessionId: string;
}
export declare class AgentCacheManager {
    private cache;
    private readonly maxCacheSize;
    private readonly ttlMs;
    private cleanupTimer;
    constructor();
    private generateCacheKey;
    private hashString;
    getAgent(config: AgentConfig): Promise<any>;
    private createAgentWithConfig;
    private addToCache;
    private isEntryValid;
    private evictLRU;
    private cleanup;
    getStats(): {
        totalEntries: number;
        maxSize: number;
        ttlMs: number;
        entries: Array<{
            hitCount: number;
            age: string;
            lastUsed: string;
        }>;
    };
    private formatDuration;
    clearCache(): void;
    destroy(): void;
}
export declare const agentCacheManager: AgentCacheManager;
//# sourceMappingURL=agentCacheManager.d.ts.map