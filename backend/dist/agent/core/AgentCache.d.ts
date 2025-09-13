import type { AgentCacheKey, AgentStats } from './types/agent.types';
export declare class AgentCache {
    private cache;
    private maxEntriesPerSession;
    private maxTotalEntries;
    private stats;
    private createCacheKeyString;
    get(sessionId: string, key: AgentCacheKey): any | null;
    set(sessionId: string, key: AgentCacheKey, executor: any): void;
    private evictIfNeeded;
    private evictGlobally;
    clearSession(sessionId: string): void;
    clearAll(): void;
    getStats(): AgentStats;
}
//# sourceMappingURL=AgentCache.d.ts.map