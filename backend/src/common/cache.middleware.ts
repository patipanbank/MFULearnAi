import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  skipIf?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  compress?: boolean; // Enable response compression
  tags?: string[]; // Cache tags for invalidation
}

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  tags?: string[];
}

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CacheMiddleware.name);
  private readonly redis: Redis;
  private readonly defaultConfig: CacheConfig = {
    ttl: 300, // 5 minutes
    compress: true,
    varyBy: ['accept', 'accept-encoding']
  };

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.applyCache(req, res, next, this.defaultConfig);
  }

  /**
   * Create cache middleware with custom configuration
   */
  static create(config: Partial<CacheConfig>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const middleware = new CacheMiddleware();
      const finalConfig = { ...middleware.defaultConfig, ...config };
      middleware.applyCache(req, res, next, finalConfig);
    };
  }

  /**
   * Apply caching logic
   */
  private async applyCache(
    req: Request,
    res: Response,
    next: NextFunction,
    config: CacheConfig
  ) {
    try {
      // Skip caching for certain conditions
      if (this.shouldSkipCache(req, config)) {
        return next();
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(req, config);
      
      // Try to get cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        this.logger.debug(`Cache HIT for key: ${cacheKey}`);
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-Age', String(Math.floor((Date.now() - cachedResponse.timestamp) / 1000)));
        
        // Set original headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.set(key, value);
        });
        
        return res.status(cachedResponse.statusCode).send(cachedResponse.body);
      }

      // Cache miss - intercept response
      this.logger.debug(`Cache MISS for key: ${cacheKey}`);
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original methods
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      let responseBody: any;
      let responseSent = false;

      // Override send method
      const self = this;
      res.send = function(body: any) {
        if (!responseSent) {
          responseBody = body;
          responseSent = true;
          
          // Cache the response
          self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), body, config).catch(error => {
            self.logger.error('Failed to cache response:', error);
          });
        }
        return originalSend.call(this, body);
      };

      // Override json method
      res.json = function(obj: any) {
        if (!responseSent) {
          responseBody = obj;
          responseSent = true;
          
          // Cache the response
          self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), JSON.stringify(obj), config).catch(error => {
            self.logger.error('Failed to cache response:', error);
          });
        }
        return originalJson.call(this, obj);
      };

      // Override end method
      res.end = function(chunk?: any, encoding?: any) {
        if (!responseSent && chunk) {
          responseBody = chunk;
          responseSent = true;
          
          // Cache the response
          self.cacheResponse(cacheKey, res.statusCode, res.getHeaders(), chunk, config).catch(error => {
            self.logger.error('Failed to cache response:', error);
          });
        }
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    } catch (error) {
      this.logger.error('Cache middleware error:', error);
      next();
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(req: Request, config: CacheConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    const parts = [`cache:${req.method}:${req.path}`];
    
    // Add query parameters
    if (Object.keys(req.query).length > 0) {
      const sortedQuery = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join('&');
      parts.push(`query:${sortedQuery}`);
    }

    // Add vary headers
    if (config.varyBy) {
      config.varyBy.forEach(header => {
        const headerValue = req.headers[header.toLowerCase()];
        if (headerValue) {
          parts.push(`${header}:${headerValue}`);
        }
      });
    }

    // Add user context if available
    const user = (req as any).user;
    if (user) {
      parts.push(`user:${user.id}`);
    }

    return parts.join(':');
  }

  /**
   * Check if caching should be skipped
   */
  private shouldSkipCache(req: Request, config: CacheConfig): boolean {
    // Skip for non-GET requests
    if (req.method !== 'GET') {
      return true;
    }

    // Skip if custom condition is met
    if (config.skipIf && config.skipIf(req)) {
      return true;
    }

    // Skip if cache-control header says no-cache
    const cacheControl = req.headers['cache-control'];
    if (cacheControl && cacheControl.includes('no-cache')) {
      return true;
    }

    // Skip for admin endpoints in development
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/admin')) {
      return true;
    }

    return false;
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) return null;

      const response: CachedResponse = JSON.parse(cached);
      
      // Check if expired
      const now = Date.now();
      const age = (now - response.timestamp) / 1000;
      
      if (age > 3600) { // Max 1 hour regardless of TTL
        await this.redis.del(cacheKey);
        return null;
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to get cached response:', error);
      return null;
    }
  }

  /**
   * Cache response
   */
  private async cacheResponse(
    cacheKey: string,
    statusCode: number,
    headers: any,
    body: any,
    config: CacheConfig
  ): Promise<void> {
    try {
      // Only cache successful responses
      if (statusCode < 200 || statusCode >= 300) {
        return;
      }

      // Skip caching large responses (> 1MB)
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      if (bodyString.length > 1024 * 1024) {
        this.logger.warn(`Skipping cache for large response: ${bodyString.length} bytes`);
        return;
      }

      const cachedResponse: CachedResponse = {
        statusCode,
        headers: this.filterHeaders(headers),
        body: bodyString,
        timestamp: Date.now(),
        tags: config.tags
      };

      await this.redis.setex(cacheKey, config.ttl, JSON.stringify(cachedResponse));
      
      // Add to tag index if tags are provided
      if (config.tags) {
        await Promise.all(config.tags.map(tag => 
          this.redis.sadd(`cache:tag:${tag}`, cacheKey)
        ));
      }

      this.logger.debug(`Cached response for key: ${cacheKey} (TTL: ${config.ttl}s)`);
    } catch (error) {
      this.logger.error('Failed to cache response:', error);
    }
  }

  /**
   * Filter headers that should be cached
   */
  private filterHeaders(headers: any): Record<string, string> {
    const filtered: Record<string, string> = {};
    const allowedHeaders = [
      'content-type',
      'content-encoding',
      'content-language',
      'etag',
      'last-modified',
      'expires'
    ];

    Object.entries(headers).forEach(([key, value]) => {
      if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        filtered[key] = value;
      }
    });

    return filtered;
  }

  /**
   * Invalidate cache by key
   */
  async invalidateCache(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Invalidated cache key: ${key}`);
    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redis.smembers(`cache:tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`cache:tag:${tag}`);
        this.logger.debug(`Invalidated ${keys.length} cache entries with tag: ${tag}`);
      }
    } catch (error) {
      this.logger.error('Failed to invalidate cache by tag:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }
}

/**
 * Pre-configured cache middlewares
 */
export class CachePresets {
  
  /**
   * Short-term cache for frequently accessed data
   */
  static shortTerm() {
    return CacheMiddleware.create({
      ttl: 60, // 1 minute
      tags: ['short-term']
    });
  }

  /**
   * Medium-term cache for stable data
   */
  static mediumTerm() {
    return CacheMiddleware.create({
      ttl: 300, // 5 minutes
      tags: ['medium-term']
    });
  }

  /**
   * Long-term cache for rarely changing data
   */
  static longTerm() {
    return CacheMiddleware.create({
      ttl: 3600, // 1 hour
      tags: ['long-term']
    });
  }

  /**
   * Cache for static content
   */
  static static() {
    return CacheMiddleware.create({
      ttl: 86400, // 24 hours
      tags: ['static'],
      skipIf: (req) => req.headers['cache-control']?.includes('no-cache') || false
    });
  }

  /**
   * User-specific cache
   */
  static userSpecific(ttl: number = 300) {
    return CacheMiddleware.create({
      ttl,
      keyGenerator: (req) => {
        const user = (req as any).user;
        const userPart = user ? `user:${user.id}` : 'anonymous';
        return `cache:user:${userPart}:${req.method}:${req.path}`;
      },
      tags: ['user-specific']
    });
  }

  /**
   * Collection-specific cache
   */
  static collection(collectionId: string, ttl: number = 600) {
    return CacheMiddleware.create({
      ttl,
      keyGenerator: (req) => `cache:collection:${collectionId}:${req.method}:${req.path}`,
      tags: [`collection:${collectionId}`]
    });
  }
} 