"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCache = void 0;
class AgentCache {
    constructor() {
        this.cache = new Map();
        this.maxEntriesPerSession = 5;
        this.maxTotalEntries = 50;
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0
        };
    }
    createCacheKeyString(key) {
        return JSON.stringify({
            modelId: key.modelId,
            systemPrompt: key.systemPrompt.substring(0, 100),
            toolNames: key.toolNames,
            temperature: key.temperature,
            maxTokens: key.maxTokens
        });
    }
    get(sessionId, key) {
        const sessionCache = this.cache.get(sessionId);
        if (!sessionCache) {
            this.stats.cacheMisses++;
            return null;
        }
        const keyString = this.createCacheKeyString(key);
        const entry = sessionCache.get(keyString);
        if (!entry) {
            this.stats.cacheMisses++;
            return null;
        }
        entry.lastUsed = new Date();
        this.stats.cacheHits++;
        return entry.executor;
    }
    set(sessionId, key, executor) {
        if (!this.cache.has(sessionId)) {
            this.cache.set(sessionId, new Map());
        }
        const sessionCache = this.cache.get(sessionId);
        const keyString = this.createCacheKeyString(key);
        this.evictIfNeeded(sessionCache);
        const entry = {
            key,
            executor,
            createdAt: new Date(),
            lastUsed: new Date()
        };
        sessionCache.set(keyString, entry);
        console.log(`💾 Cached agent for session ${sessionId}, cache size: ${sessionCache.size}`);
    }
    evictIfNeeded(sessionCache) {
        if (sessionCache.size >= this.maxEntriesPerSession) {
            let oldestKey = '';
            let oldestTime = new Date();
            for (const [key, entry] of sessionCache.entries()) {
                if (entry.lastUsed < oldestTime) {
                    oldestTime = entry.lastUsed;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                sessionCache.delete(oldestKey);
                console.log(`🗑️ Evicted old cache entry`);
            }
        }
        const totalSize = Array.from(this.cache.values()).reduce((sum, map) => sum + map.size, 0);
        if (totalSize >= this.maxTotalEntries) {
            this.evictGlobally();
        }
    }
    evictGlobally() {
        const allEntries = [];
        for (const [sessionId, sessionCache] of this.cache.entries()) {
            for (const [key, entry] of sessionCache.entries()) {
                allEntries.push({ sessionId, key, entry });
            }
        }
        allEntries.sort((a, b) => a.entry.lastUsed.getTime() - b.entry.lastUsed.getTime());
        const toDelete = Math.floor(allEntries.length * 0.25);
        for (let i = 0; i < toDelete; i++) {
            const { sessionId, key } = allEntries[i];
            this.cache.get(sessionId)?.delete(key);
        }
        console.log(`🗑️ Global cache eviction: removed ${toDelete} entries`);
    }
    clearSession(sessionId) {
        const deleted = this.cache.delete(sessionId);
        if (deleted) {
            console.log(`🗑️ Cleared cache for session ${sessionId}`);
        }
    }
    clearAll() {
        const totalEntries = Array.from(this.cache.values()).reduce((sum, map) => sum + map.size, 0);
        this.cache.clear();
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        console.log(`🗑️ Cleared all cache: ${totalEntries} entries`);
    }
    getStats() {
        const totalSessions = this.cache.size;
        const cachedAgents = Array.from(this.cache.values()).reduce((sum, map) => sum + map.size, 0);
        return {
            totalSessions,
            cachedAgents,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses
        };
    }
}
exports.AgentCache = AgentCache;
//# sourceMappingURL=AgentCache.js.map