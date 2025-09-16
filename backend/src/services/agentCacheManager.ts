import { createAgent } from '../agent/agentFactory';
import { getLLM } from '../agent/llmFactory';
import { toolRegistry, createMemoryTool, createRetrievalTools, ToolFunction } from '../agent/toolRegistry';

export interface AgentCacheEntry {
  executor: any; // AgentExecutor
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

/**
 * AgentCacheManager - Intelligent agent caching with TTL, LRU eviction, and smart key generation
 *
 * Features:
 * - Smart cache keys based on agent configuration signature
 * - TTL-based expiration (default: 1 hour)
 * - LRU eviction when cache is full (default: 50 agents)
 * - Hit count tracking for analytics
 * - Automatic cleanup of expired entries
 * - Memory usage optimization
 */
export class AgentCacheManager {
  private cache: Map<string, AgentCacheEntry> = new Map();
  private readonly maxCacheSize: number = 50; // Maximum 50 cached agents
  private readonly ttlMs: number = 60 * 60 * 1000; // 1 hour TTL
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup timer - run every 15 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000);

    console.log('✅ AgentCacheManager initialized');
  }

  /**
   * Generate smart cache key from agent configuration
   */
  private generateCacheKey(config: AgentConfig): string {
    // Create signature based on configuration that affects agent behavior
    const keyComponents = {
      modelId: config.modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      systemPromptHash: this.hashString(config.systemPrompt),
      collections: config.collectionNames.slice().sort(), // Sorted for consistency
    };

    // Don't include sessionId in cache key - multiple sessions can share the same agent config
    return JSON.stringify(keyComponents);
  }

  /**
   * Simple hash function for system prompts to reduce key size
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get or create agent with intelligent caching
   */
  async getAgent(config: AgentConfig): Promise<any> {
    const cacheKey = this.generateCacheKey(config);

    // Check if agent exists in cache and is still valid
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && this.isEntryValid(cachedEntry)) {
      // Update usage statistics
      cachedEntry.lastUsed = new Date();
      cachedEntry.hitCount++;

      console.log(`⚡ Cache HIT for agent config (${cachedEntry.hitCount} hits)`);
      return cachedEntry.executor;
    }

    // Remove expired entry if exists
    if (cachedEntry) {
      console.log(`🗑️ Removing expired agent from cache`);
      this.cache.delete(cacheKey);
    }

    console.log(`🤖 Cache MISS - Creating new agent`);

    // Create new agent
    const agent = await this.createAgentWithConfig(config);

    // Add to cache (with eviction if needed)
    this.addToCache(cacheKey, agent, config);

    return agent;
  }

  /**
   * Create agent with full configuration
   */
  private async createAgentWithConfig(config: AgentConfig): Promise<any> {
    const llm = getLLM(config.modelId, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      streaming: true
    });

    // Setup tools using existing system
    const sessionTools = createMemoryTool(config.sessionId);
    const allTools: { [name: string]: ToolFunction } = {};

    // Add registry tools
    for (const [k, v] of Object.entries(toolRegistry)) {
      allTools[k] = v.func;
    }

    // Add session tools
    for (const [k, v] of Object.entries(sessionTools)) {
      allTools[k] = v.func;
    }

    // Add retrieval tools if collections specified
    if (config.collectionNames && config.collectionNames.length > 0) {
      const retrievalTools = createRetrievalTools(config.collectionNames);
      for (const [name, tool] of Object.entries(retrievalTools)) {
        allTools[name] = (tool as any).func;
      }
    }

    return await createAgent(llm, allTools, config.systemPrompt, {
      modelId: config.modelId,
      sessionId: config.sessionId,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });
  }

  /**
   * Add agent to cache with LRU eviction
   */
  private addToCache(cacheKey: string, agent: any, config: AgentConfig): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    const entry: AgentCacheEntry = {
      executor: agent,
      createdAt: new Date(),
      lastUsed: new Date(),
      hitCount: 0,
      signature: cacheKey
    };

    this.cache.set(cacheKey, entry);
    console.log(`💾 Added agent to cache (${this.cache.size}/${this.maxCacheSize})`);
  }

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isEntryValid(entry: AgentCacheEntry): boolean {
    const now = new Date();
    const ageMs = now.getTime() - entry.createdAt.getTime();
    return ageMs < this.ttlMs;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestEntry: { key: string; entry: AgentCacheEntry } | null = null;

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

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const before = this.cache.size;
    const now = new Date();
    const expiredKeys: string[] = [];

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

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    maxSize: number;
    ttlMs: number;
    entries: Array<{
      hitCount: number;
      age: string;
      lastUsed: string;
    }>;
  } {
    const entries = Array.from(this.cache.values()).map(entry => ({
      hitCount: entry.hitCount,
      age: this.formatDuration(Date.now() - entry.createdAt.getTime()),
      lastUsed: this.formatDuration(Date.now() - entry.lastUsed.getTime()) + ' ago'
    }));

    return {
      totalEntries: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.ttlMs,
      entries: entries.sort((a, b) => b.hitCount - a.hitCount) // Sort by hit count
    };
  }

  /**
   * Format duration in human readable form
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(ms / 1000)}s`;
  }

  /**
   * Clear all cached agents
   */
  clearCache(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cleared all ${count} agents from cache`);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearCache();
    console.log('🛑 AgentCacheManager destroyed');
  }
}

export const agentCacheManager = new AgentCacheManager();