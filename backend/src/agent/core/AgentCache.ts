import type { AgentCacheKey, AgentCacheEntry, AgentStats } from './types/agent.types';

/**
 * AgentCache - จัดการ cache ของ agents
 * - LRU cache mechanism
 * - Session-based grouping
 * - Statistics tracking
 */
export class AgentCache {
  private cache: Map<string, Map<string, AgentCacheEntry>> = new Map();
  private maxEntriesPerSession = 5;
  private maxTotalEntries = 50;
  private stats = {
    cacheHits: 0,
    cacheMisses: 0
  };

  /**
   * สร้าง cache key string จาก AgentCacheKey
   */
  private createCacheKeyString(key: AgentCacheKey): string {
    return JSON.stringify({
      modelId: key.modelId,
      systemPrompt: key.systemPrompt.substring(0, 100), // ใช้แค่ส่วนหน้า
      toolNames: key.toolNames,
      temperature: key.temperature,
      maxTokens: key.maxTokens
    });
  }

  /**
   * ดึง agent จาก cache
   */
  public get(sessionId: string, key: AgentCacheKey): any | null {
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

    // Update last used time
    entry.lastUsed = new Date();
    this.stats.cacheHits++;
    
    return entry.executor;
  }

  /**
   * เพิ่ม agent เข้า cache
   */
  public set(sessionId: string, key: AgentCacheKey, executor: any): void {
    // สร้าง session cache ถ้าไม่มี
    if (!this.cache.has(sessionId)) {
      this.cache.set(sessionId, new Map());
    }

    const sessionCache = this.cache.get(sessionId)!;
    const keyString = this.createCacheKeyString(key);

    // ตรวจสอบขนาด cache
    this.evictIfNeeded(sessionCache);

    // เพิ่ม entry ใหม่
    const entry: AgentCacheEntry = {
      key,
      executor,
      createdAt: new Date(),
      lastUsed: new Date()
    };

    sessionCache.set(keyString, entry);
    console.log(`💾 Cached agent for session ${sessionId}, cache size: ${sessionCache.size}`);
  }

  /**
   * ลบ entries เก่าออกเมื่อเต็ม
   */
  private evictIfNeeded(sessionCache: Map<string, AgentCacheEntry>): void {
    if (sessionCache.size >= this.maxEntriesPerSession) {
      // หา entry ที่ใช้นานที่สุด
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

    // ตรวจสอบ total cache size
    const totalSize = Array.from(this.cache.values()).reduce((sum, map) => sum + map.size, 0);
    if (totalSize >= this.maxTotalEntries) {
      this.evictGlobally();
    }
  }

  /**
   * ลบ entries เก่าออกแบบ global
   */
  private evictGlobally(): void {
    const allEntries: Array<{ sessionId: string; key: string; entry: AgentCacheEntry }> = [];

    // รวบรวม entries ทั้งหมด
    for (const [sessionId, sessionCache] of this.cache.entries()) {
      for (const [key, entry] of sessionCache.entries()) {
        allEntries.push({ sessionId, key, entry });
      }
    }

    // เรียงตามเวลาใช้งาน
    allEntries.sort((a, b) => a.entry.lastUsed.getTime() - b.entry.lastUsed.getTime());

    // ลบ 25% ของ entries
    const toDelete = Math.floor(allEntries.length * 0.25);
    for (let i = 0; i < toDelete; i++) {
      const { sessionId, key } = allEntries[i];
      this.cache.get(sessionId)?.delete(key);
    }

    console.log(`🗑️ Global cache eviction: removed ${toDelete} entries`);
  }

  /**
   * ล้าง cache ของ session
   */
  public clearSession(sessionId: string): void {
    const deleted = this.cache.delete(sessionId);
    if (deleted) {
      console.log(`🗑️ Cleared cache for session ${sessionId}`);
    }
  }

  /**
   * ล้าง cache ทั้งหมด
   */
  public clearAll(): void {
    const totalEntries = Array.from(this.cache.values()).reduce((sum, map) => sum + map.size, 0);
    this.cache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
    console.log(`🗑️ Cleared all cache: ${totalEntries} entries`);
  }

  /**
   * ดู cache statistics
   */
  public getStats(): AgentStats {
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