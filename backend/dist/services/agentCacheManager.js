"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentCacheManager = exports.AgentCacheManager = void 0;
const agentFactory_1 = require("../agent/agentFactory");
const llmFactory_1 = require("../agent/llmFactory");
const toolRegistry_1 = require("../agent/toolRegistry");
class AgentCacheManager {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 50;
        this.ttlMs = 60 * 60 * 1000;
        this.cleanupTimer = null;
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, 15 * 60 * 1000);
        console.log('✅ AgentCacheManager initialized');
    }
    generateCacheKey(config) {
        const keyComponents = {
            modelId: config.modelId,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            systemPromptHash: this.hashString(config.systemPrompt),
            collections: config.collectionNames.slice().sort(),
        };
        return JSON.stringify(keyComponents);
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    async getAgent(config) {
        const cacheKey = this.generateCacheKey(config);
        const cachedEntry = this.cache.get(cacheKey);
        if (cachedEntry && this.isEntryValid(cachedEntry)) {
            cachedEntry.lastUsed = new Date();
            cachedEntry.hitCount++;
            console.log(`⚡ Cache HIT for agent config (${cachedEntry.hitCount} hits)`);
            return cachedEntry.executor;
        }
        if (cachedEntry) {
            console.log(`🗑️ Removing expired agent from cache`);
            this.cache.delete(cacheKey);
        }
        console.log(`🤖 Cache MISS - Creating new agent`);
        const agent = await this.createAgentWithConfig(config);
        this.addToCache(cacheKey, agent, config);
        return agent;
    }
    async createAgentWithConfig(config) {
        const llm = (0, llmFactory_1.getLLM)(config.modelId, {
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            streaming: true
        });
        const sessionTools = (0, toolRegistry_1.createMemoryTool)(config.sessionId);
        const allTools = {};
        for (const [k, v] of Object.entries(toolRegistry_1.toolRegistry)) {
            allTools[k] = v.func;
        }
        for (const [k, v] of Object.entries(sessionTools)) {
            allTools[k] = v.func;
        }
        if (config.collectionNames && config.collectionNames.length > 0) {
            const retrievalTools = (0, toolRegistry_1.createRetrievalTools)(config.collectionNames);
            for (const [name, tool] of Object.entries(retrievalTools)) {
                allTools[name] = tool.func;
            }
        }
        return await (0, agentFactory_1.createAgent)(llm, allTools, config.systemPrompt, {
            modelId: config.modelId,
            sessionId: config.sessionId,
            temperature: config.temperature,
            maxTokens: config.maxTokens
        });
    }
    addToCache(cacheKey, agent, config) {
        if (this.cache.size >= this.maxCacheSize) {
            this.evictLRU();
        }
        const entry = {
            executor: agent,
            createdAt: new Date(),
            lastUsed: new Date(),
            hitCount: 0,
            signature: cacheKey
        };
        this.cache.set(cacheKey, entry);
        console.log(`💾 Added agent to cache (${this.cache.size}/${this.maxCacheSize})`);
    }
    isEntryValid(entry) {
        const now = new Date();
        const ageMs = now.getTime() - entry.createdAt.getTime();
        return ageMs < this.ttlMs;
    }
    evictLRU() {
        let oldestEntry = null;
        for (const [key, entry] of this.cache.entries()) {
            if (!oldestEntry || entry.lastUsed < oldestEntry.entry.lastUsed) {
                oldestEntry = { key, entry };
            }
        }
        if (oldestEntry) {
            this.cache.delete(oldestEntry.key);
            console.log(`🗑️ Evicted LRU agent from cache (last used: ${oldestEntry.entry.lastUsed.toISOString()})`);
        }
    }
    cleanup() {
        const before = this.cache.size;
        const now = new Date();
        const expiredKeys = [];
        for (const [key, entry] of this.cache.entries()) {
            if (!this.isEntryValid(entry)) {
                expiredKeys.push(key);
            }
        }
        expiredKeys.forEach(key => this.cache.delete(key));
        if (expiredKeys.length > 0) {
            console.log(`🧹 Cleaned up ${expiredKeys.length} expired agents from cache (${before} → ${this.cache.size})`);
        }
    }
    getStats() {
        const entries = Array.from(this.cache.values()).map(entry => ({
            hitCount: entry.hitCount,
            age: this.formatDuration(Date.now() - entry.createdAt.getTime()),
            lastUsed: this.formatDuration(Date.now() - entry.lastUsed.getTime()) + ' ago'
        }));
        return {
            totalEntries: this.cache.size,
            maxSize: this.maxCacheSize,
            ttlMs: this.ttlMs,
            entries: entries.sort((a, b) => b.hitCount - a.hitCount)
        };
    }
    formatDuration(ms) {
        const minutes = Math.floor(ms / (60 * 1000));
        const hours = Math.floor(minutes / 60);
        if (hours > 0)
            return `${hours}h ${minutes % 60}m`;
        if (minutes > 0)
            return `${minutes}m`;
        return `${Math.floor(ms / 1000)}s`;
    }
    clearCache() {
        const count = this.cache.size;
        this.cache.clear();
        console.log(`🧹 Cleared all ${count} agents from cache`);
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clearCache();
        console.log('🛑 AgentCacheManager destroyed');
    }
}
exports.AgentCacheManager = AgentCacheManager;
exports.agentCacheManager = new AgentCacheManager();
//# sourceMappingURL=agentCacheManager.js.map