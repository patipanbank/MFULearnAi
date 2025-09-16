/**
 * State Cache Management
 * Handles localStorage persistence, cache invalidation, and memory management
 */

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  compress?: boolean; // Enable compression for large data
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessed: number;
  ttl?: number;
}

class StateCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private compressionEnabled: boolean;

  constructor(maxSize = 100, compressionEnabled = false) {
    this.maxSize = maxSize;
    this.compressionEnabled = compressionEnabled;
  }

  set<T>(key: string, data: T, config?: CacheConfig): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessed: now,
      ttl: config?.ttl,
    };

    // Remove expired entries before adding new ones
    this.cleanup();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);

    // Persist to localStorage if needed
    this.persistToStorage(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      // Try to load from localStorage
      const stored = this.loadFromStorage<T>(key);
      if (stored) {
        this.cache.set(key, stored);
        return stored.data;
      }
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromStorage(key);
      return null;
    }

    // Update access time for LRU
    entry.accessed = Date.now();
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    this.removeFromStorage(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.clearStorage();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: (this.cache.size / this.maxSize) * 100,
      expired: entries.filter(entry => this.isExpired(entry)).length,
      averageAge: entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length || 0,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < oldestTime) {
        oldestTime = entry.accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }

  private persistToStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const storageKey = `cache_${key}`;
      const serialized = JSON.stringify(entry);
      localStorage.setItem(storageKey, serialized);
    } catch (error) {
      console.warn('Failed to persist cache entry to localStorage:', error);
    }
  }

  private loadFromStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const storageKey = `cache_${key}`;
      const serialized = localStorage.getItem(storageKey);
      if (!serialized) return null;

      const entry = JSON.parse(serialized) as CacheEntry<T>;

      // Check if expired
      if (this.isExpired(entry)) {
        this.removeFromStorage(key);
        return null;
      }

      return entry;
    } catch (error) {
      console.warn('Failed to load cache entry from localStorage:', error);
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    try {
      const storageKey = `cache_${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to remove cache entry from localStorage:', error);
    }
  }

  private clearStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear cache from localStorage:', error);
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2; // Rough estimate (UTF-16)
    }
    return totalSize;
  }
}

// Global cache instances
export const chatCache = new StateCache(50); // For chat sessions
export const messageCache = new StateCache(200); // For individual messages
export const agentCache = new StateCache(20); // For agent data
export const uiCache = new StateCache(30); // For UI state

// Cache utility functions
export const cacheUtils = {
  // Preload frequently accessed data
  preloadUserData: async (userId: string) => {
    const cacheKey = `user_${userId}_data`;
    if (!chatCache.has(cacheKey)) {
      // Would implement actual data loading
      console.log('Preloading user data...');
    }
  },

  // Cache chat list with smart refresh
  cacheChats: (chats: any[], userId: string) => {
    const cacheKey = `user_${userId}_chats`;
    chatCache.set(cacheKey, chats, { ttl: 5 * 60 * 1000 }); // 5 minutes TTL
  },

  // Get cached chats
  getCachedChats: (userId: string) => {
    const cacheKey = `user_${userId}_chats`;
    return chatCache.get(cacheKey);
  },

  // Cache individual messages for quick access
  cacheMessage: (messageId: string, message: any) => {
    messageCache.set(`msg_${messageId}`, message, { ttl: 30 * 60 * 1000 }); // 30 minutes
  },

  // Batch cache multiple messages
  cacheMessages: (messages: any[]) => {
    messages.forEach(msg => {
      if (msg.id) {
        cacheUtils.cacheMessage(msg.id, msg);
      }
    });
  },

  // Get cache statistics for monitoring
  getAllStats: () => ({
    chat: chatCache.getStats(),
    message: messageCache.getStats(),
    agent: agentCache.getStats(),
    ui: uiCache.getStats(),
  }),

  // Clear all caches
  clearAll: () => {
    chatCache.clear();
    messageCache.clear();
    agentCache.clear();
    uiCache.clear();
  },

  // Memory management
  cleanup: () => {
    const stats = cacheUtils.getAllStats();

    // Clear caches if memory usage is too high
    Object.entries(stats).forEach(([name, stat]) => {
      if (stat.usage > 90) {
        console.warn(`Cache ${name} is at ${stat.usage}% capacity, clearing expired entries`);

        switch (name) {
          case 'chat':
            chatCache.clear();
            break;
          case 'message':
            messageCache.clear();
            break;
          case 'agent':
            agentCache.clear();
            break;
          case 'ui':
            uiCache.clear();
            break;
        }
      }
    });
  },
};

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheUtils.cleanup();
  }, 5 * 60 * 1000);
}

export default StateCache;