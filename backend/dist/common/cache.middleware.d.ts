import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export interface CacheConfig {
    ttl: number;
    keyGenerator?: (req: Request) => string;
    skipIf?: (req: Request) => boolean;
    varyBy?: string[];
    compress?: boolean;
    tags?: string[];
}
export declare class CacheMiddleware implements NestMiddleware {
    private readonly logger;
    private readonly redis;
    private readonly defaultConfig;
    constructor();
    use(req: Request, res: Response, next: NextFunction): void;
    static create(config: Partial<CacheConfig>): (req: Request, res: Response, next: NextFunction) => void;
    private applyCache;
    private generateCacheKey;
    private shouldSkipCache;
    private getCachedResponse;
    private cacheResponse;
    private filterHeaders;
    invalidateCache(key: string): Promise<void>;
    invalidateByTag(tag: string): Promise<void>;
    clearCache(): Promise<void>;
}
export declare class CachePresets {
    static shortTerm(): (req: Request, res: Response, next: NextFunction) => void;
    static mediumTerm(): (req: Request, res: Response, next: NextFunction) => void;
    static longTerm(): (req: Request, res: Response, next: NextFunction) => void;
    static static(): (req: Request, res: Response, next: NextFunction) => void;
    static userSpecific(ttl?: number): (req: Request, res: Response, next: NextFunction) => void;
    static collection(collectionId: string, ttl?: number): (req: Request, res: Response, next: NextFunction) => void;
}
