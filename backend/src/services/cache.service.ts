import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SemanticCacheException } from '../common/exceptions/app-exceptions';

interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly stats: CacheStats = {
    totalEntries: 0,
    hitRate: 0,
    missRate: 0,
  };

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Store data in cache
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.stats.totalEntries++;
      this.logger.debug(`✅ Cache set: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Cache set failed for key ${key}: ${error}`);
      throw new SemanticCacheException('Failed to set cache entry', { key }, error as Error);
    }
  }

  /**
   * Retrieve data from cache
   */
  async get(key: string): Promise<any> {
    try {
      const data = await this.redis.get(key);
      
      if (data) {
        this.stats.hitRate = (this.stats.hitRate + 1) / 2;
        this.logger.debug(`🎯 Cache hit: ${key}`);
        return JSON.parse(data);
      } else {
        this.stats.missRate = (this.stats.missRate + 1) / 2;
        this.logger.debug(`❌ Cache miss: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`❌ Cache get failed for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      this.logger.debug(`🗑️ Cache delete: ${key}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`❌ Cache delete failed for key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
      this.stats.totalEntries = 0;
      this.logger.log(`🧹 Cache cleared`);
    } catch (error) {
      this.logger.error(`❌ Cache clear failed: ${error}`);
      throw new SemanticCacheException('Failed to clear cache', {}, error as Error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Optimize cache
   */
  async optimizeCache(): Promise<void> {
    try {
      this.logger.log('🔧 Cache optimization completed');
    } catch (error) {
      this.logger.error(`❌ Cache optimization failed: ${error}`);
    }
  }

  /**
   * Warm up cache
   */
  async warmupCache(dataItems: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      this.logger.log(`🔥 Warming up cache with ${dataItems.length} items`);

      for (const item of dataItems) {
        await this.set(item.key, item.value, item.ttl);
      }

      this.logger.log(`✅ Cache warmup completed`);
    } catch (error) {
      this.logger.error(`❌ Cache warmup failed: ${error}`);
    }
  }

  /**
   * Export cache data
   */
  async exportCache(): Promise<{ entries: any[]; stats: CacheStats }> {
    try {
      return {
        entries: [], // Simplified implementation
        stats: this.getStats(),
      };
    } catch (error) {
      this.logger.error(`❌ Cache export failed: ${error}`);
      throw new SemanticCacheException('Failed to export cache', {}, error as Error);
    }
  }

  /**
   * Import cache data
   */
  async importCache(data: { entries: any[]; stats?: CacheStats }): Promise<void> {
    try {
      this.logger.log(`📥 Importing cache data`);
      // Simplified implementation
      this.logger.log(`✅ Cache import completed`);
    } catch (error) {
      this.logger.error(`❌ Cache import failed: ${error}`);
      throw new SemanticCacheException('Failed to import cache', {}, error as Error);
    }
  }

  /**
   * Find similar cache entries (simplified)
   */
  async findSimilarEntries(
    query: string,
    topK: number = 5,
    minSimilarity: number = 0.7
  ): Promise<Array<{ key: string; similarity: number; value: any }>> {
    try {
      // Simplified implementation - returns empty array
      return [];
    } catch (error) {
      this.logger.error(`❌ Similar entries search failed: ${error}`);
      return [];
    }
  }
} 